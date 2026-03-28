import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas } from '@/engine/render/drawUtils.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default class IdealGasLawSim extends SimulationEngine {
  private temperature = 300;
  private particleCount = 80;
  private showHistogram = false;
  private showSpeedColoring = true;
  private particles: Particle[] = [];

  // Container geometry
  private boxLeft = 60;
  private boxTop = 60;
  private boxBottom = 0;
  private wallX = 0; // right wall, draggable
  private wallMinX = 180;
  private wallMaxX = 0;

  // Interaction
  private draggingWall = false;

  // Physics
  private readonly kB = 1.38e-23;
  private readonly particleMass = 4.65e-26; // ~N2
  private readonly R = 8.314;
  private wallCollisions = 0;
  private collisionAccum = 0;
  private pressure = 0;
  private pressureSmoothed = 0;

  setup(): void {
    this.boxBottom = this.height - 60;
    this.wallMaxX = this.width - 40;
    this.wallX = this.wallMaxX;
    this.initParticles();
  }

  private speedForTemp(): number {
    // RMS speed scaled for visual: v_rms = sqrt(3kT/m), but we scale for canvas
    return Math.sqrt(3 * this.kB * this.temperature / this.particleMass) * 0.004;
  }

  private initParticles(): void {
    this.particles = [];
    const speed = this.speedForTemp();
    for (let i = 0; i < this.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random());
      this.particles.push({
        x: this.boxLeft + 10 + Math.random() * (this.wallX - this.boxLeft - 20),
        y: this.boxTop + 10 + Math.random() * (this.boxBottom - this.boxTop - 20),
        vx: s * Math.cos(angle),
        vy: s * Math.sin(angle),
      });
    }
    this.wallCollisions = 0;
    this.collisionAccum = 0;
    this.pressureSmoothed = 0;
  }

  private rescaleVelocities(): void {
    const target = this.speedForTemp();
    for (const p of this.particles) {
      const s = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (s > 0.001) {
        const ratio = target / s * (0.7 + 0.6 * Math.random());
        p.vx *= ratio;
        p.vy *= ratio;
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.collisionAccum += dt;

    const subSteps = 4;
    const subDt = dt / subSteps;
    let wallHits = 0;

    for (let s = 0; s < subSteps; s++) {
      for (const p of this.particles) {
        p.x += p.vx * subDt * 300;
        p.y += p.vy * subDt * 300;

        // Left wall
        if (p.x < this.boxLeft + 3) {
          p.x = this.boxLeft + 3;
          p.vx = Math.abs(p.vx);
        }
        // Right wall (draggable)
        if (p.x > this.wallX - 3) {
          p.x = this.wallX - 3;
          p.vx = -Math.abs(p.vx);
          wallHits++;
        }
        // Top wall
        if (p.y < this.boxTop + 3) {
          p.y = this.boxTop + 3;
          p.vy = Math.abs(p.vy);
        }
        // Bottom wall
        if (p.y > this.boxBottom - 3) {
          p.y = this.boxBottom - 3;
          p.vy = -Math.abs(p.vy);
          wallHits++;
        }
      }
    }

    this.wallCollisions += wallHits;

    // Calculate pressure every 0.5s
    if (this.collisionAccum > 0.5) {
      const perimeter = 2 * ((this.wallX - this.boxLeft) + (this.boxBottom - this.boxTop));
      this.pressure = perimeter > 0 ? this.wallCollisions / (perimeter * this.collisionAccum) * 500 : 0;
      this.wallCollisions = 0;
      this.collisionAccum = 0;
    }
    this.pressureSmoothed += (this.pressure - this.pressureSmoothed) * 0.1;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50);

    // Container box
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.boxLeft, this.boxTop, this.wallX - this.boxLeft, this.boxBottom - this.boxTop);

    // Draggable wall highlight
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.fillRect(this.wallX - 6, this.boxTop, 12, this.boxBottom - this.boxTop);
    ctx.strokeStyle = this.draggingWall ? '#60a5fa' : '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.wallX, this.boxTop);
    ctx.lineTo(this.wallX, this.boxBottom);
    ctx.stroke();

    // Grip marks on wall
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    const gripY = (this.boxTop + this.boxBottom) / 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(this.wallX - 3, gripY + i * 8);
      ctx.lineTo(this.wallX + 3, gripY + i * 8);
      ctx.stroke();
    }

    // Particles
    const maxSpeed = this.speedForTemp() * 2;
    for (const p of this.particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      let color: string;
      if (this.showSpeedColoring) {
        const t = Math.min(speed / maxSpeed, 1);
        const r = Math.round(60 + t * 195);
        const g = Math.round(130 - t * 80);
        const b = Math.round(246 - t * 200);
        color = `rgb(${r},${g},${b})`;
      } else {
        color = '#60a5fa';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Velocity histogram
    if (this.showHistogram) {
      this.renderHistogram();
    }

    // PV=nRT info panel
    this.renderInfoPanel();

    // Labels
    drawText(ctx, 'Drag wall \u2194', this.wallX, this.boxBottom + 20, '#64748b', '11px system-ui', 'center');
  }

  private renderHistogram(): void {
    const { ctx } = this;
    const hx = this.boxLeft + 10;
    const hy = this.boxTop + 10;
    const hw = 160;
    const hh = 100;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(hx, hy, hw, hh);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx, hy, hw, hh);

    drawText(ctx, 'Speed Distribution', hx + hw / 2, hy + 12, '#94a3b8', '10px system-ui', 'center');

    // Bin speeds
    const bins = 15;
    const maxSpeed = this.speedForTemp() * 3;
    const counts = new Array(bins).fill(0);
    for (const p of this.particles) {
      const s = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const bin = Math.min(Math.floor((s / maxSpeed) * bins), bins - 1);
      counts[bin]++;
    }
    const maxCount = Math.max(...counts, 1);
    const barW = (hw - 20) / bins;
    const barMaxH = hh - 30;

    for (let i = 0; i < bins; i++) {
      const bh = (counts[i] / maxCount) * barMaxH;
      const t = i / bins;
      const r = Math.round(60 + t * 195);
      const g = Math.round(130 - t * 80);
      const b = Math.round(246 - t * 200);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(hx + 10 + i * barW, hy + hh - 10 - bh, barW - 1, bh);
    }
  }

  private renderInfoPanel(): void {
    const { ctx, width } = this;
    const px = width - 15;
    const py = 20;
    const panelW = 220;
    const panelH = 110;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(px - panelW, py - 5, panelW + 5, panelH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - panelW, py - 5, panelW + 5, panelH);

    const n = this.particleCount / 100; // moles (scaled)
    const volume = (this.wallX - this.boxLeft) * (this.boxBottom - this.boxTop);
    const vScaled = volume / 10000; // scaled volume in "L"
    const pCalc = (n * this.R * this.temperature) / (vScaled > 0 ? vScaled : 0.01);
    const efficiency = this.pressureSmoothed;

    drawText(ctx, 'PV = nRT', px, py + 8, '#f59e0b', 'bold 13px monospace', 'right');
    drawText(ctx, `T = ${this.temperature} K`, px, py + 28, '#ef4444', '11px monospace', 'right');
    drawText(ctx, `n = ${n.toFixed(2)} mol`, px, py + 43, '#a855f7', '11px monospace', 'right');
    drawText(ctx, `V = ${vScaled.toFixed(2)} L`, px, py + 58, '#22c55e', '11px monospace', 'right');
    drawText(ctx, `P(calc) = ${pCalc.toFixed(1)} Pa`, px, py + 73, '#3b82f6', '11px monospace', 'right');
    drawText(ctx, `P(sim) = ${efficiency.toFixed(1)} (arb)`, px, py + 88, '#64748b', '11px monospace', 'right');
  }

  reset(): void {
    this.initParticles();
    this.time = 0;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.boxBottom = this.height - 60;
    this.wallMaxX = this.width - 40;
    if (this.wallX > this.wallMaxX) this.wallX = this.wallMaxX;
  }

  onPointerDown(x: number, y: number): void {
    if (Math.abs(x - this.wallX) < 15 && y > this.boxTop && y < this.boxBottom) {
      this.draggingWall = true;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.draggingWall) {
      this.wallX = Math.max(this.wallMinX, Math.min(this.wallMaxX, x));
      // Push particles that are now outside the wall
      for (const p of this.particles) {
        if (p.x > this.wallX - 4) {
          p.x = this.wallX - 5;
          p.vx = -Math.abs(p.vx);
        }
      }
    }
  }

  onPointerUp(_x: number, _y: number): void {
    this.draggingWall = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'temperature', label: 'Temperature', min: 100, max: 1000, step: 10, defaultValue: 300, unit: 'K' },
      { type: 'slider', key: 'particleCount', label: 'Particle Count', min: 10, max: 200, step: 1, defaultValue: 80 },
      { type: 'toggle', key: 'showHistogram', label: 'Velocity Histogram', defaultValue: false },
      { type: 'toggle', key: 'showSpeedColoring', label: 'Speed Coloring', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      temperature: this.temperature,
      particleCount: this.particleCount,
      showHistogram: this.showHistogram,
      showSpeedColoring: this.showSpeedColoring,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'temperature':
        this.temperature = value as number;
        this.rescaleVelocities();
        break;
      case 'particleCount': {
        const newCount = value as number;
        if (newCount > this.particles.length) {
          const speed = this.speedForTemp();
          for (let i = this.particles.length; i < newCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const s = speed * (0.5 + Math.random());
            this.particles.push({
              x: this.boxLeft + 10 + Math.random() * (this.wallX - this.boxLeft - 20),
              y: this.boxTop + 10 + Math.random() * (this.boxBottom - this.boxTop - 20),
              vx: s * Math.cos(angle),
              vy: s * Math.sin(angle),
            });
          }
        } else {
          this.particles.length = newCount;
        }
        this.particleCount = newCount;
        break;
      }
      case 'showHistogram':
        this.showHistogram = value as boolean;
        break;
      case 'showSpeedColoring':
        this.showSpeedColoring = value as boolean;
        break;
    }
  }
}

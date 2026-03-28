import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawText } from '@/engine/render/drawUtils.ts';

interface TestParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default class SpacetimeFabricSim extends SimulationEngine {
  private mass = 20;
  private showGridLines = true;
  private showTestParticles = true;
  private particleCount = 5;

  private massX = 0;   // normalized 0..1
  private massY = 0;
  private dragging = false;

  private particles: TestParticle[] = [];

  // Grid
  private readonly gridSize = 20;

  setup(): void {
    this.massX = this.width / 2;
    this.massY = this.height / 2;
    this.spawnParticles();
  }

  private spawnParticles(): void {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / this.particleCount + Math.random() * 0.5;
      const dist = 150 + Math.random() * 100;
      this.particles.push({
        x: this.massX + Math.cos(angle) * dist,
        y: this.massY + Math.sin(angle) * dist,
        vx: -Math.sin(angle) * 30 + (Math.random() - 0.5) * 10,
        vy: Math.cos(angle) * 30 + (Math.random() - 0.5) * 10,
      });
    }
  }

  private depressionAt(px: number, py: number): number {
    const dx = px - this.massX;
    const dy = py - this.massY;
    const r = Math.sqrt(dx * dx + dy * dy) + 10; // +10 to avoid singularity
    return (this.mass * 80) / r;
  }

  update(dt: number): void {
    this.time += dt;

    if (!this.showTestParticles) return;

    const G = this.mass * 500;
    for (const p of this.particles) {
      const dx = this.massX - p.x;
      const dy = this.massY - p.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) + 5;

      // Gravitational acceleration toward mass
      const a = G / (distSq + 100);
      p.vx += (dx / dist) * a * dt;
      p.vy += (dy / dist) * a * dt;

      // Damping to keep particles from escaping forever
      p.vx *= 0.999;
      p.vy *= 0.999;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap around if too far
      const margin = 50;
      if (p.x < -margin) p.x = this.width + margin;
      if (p.x > this.width + margin) p.x = -margin;
      if (p.y < -margin) p.y = this.height + margin;
      if (p.y > this.height + margin) p.y = -margin;
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');

    const gridN = this.gridSize;
    const cellW = width / gridN;
    const cellH = height / gridN;

    // Perspective parameters for oblique top-down view
    const tilt = 0.35;  // how much perspective tilt

    // Compute grid point positions with depression
    const points: { sx: number; sy: number; depth: number }[][] = [];
    for (let gy = 0; gy <= gridN; gy++) {
      points[gy] = [];
      for (let gx = 0; gx <= gridN; gx++) {
        const baseX = gx * cellW;
        const baseY = gy * cellH;
        const depth = this.depressionAt(baseX, baseY);

        // Apply pseudo-3D: shift y based on depth to create "sinking" effect
        const sx = baseX;
        const sy = baseY + depth * tilt;

        points[gy][gx] = { sx, sy, depth };
      }
    }

    // Draw grid
    if (this.showGridLines) {
      ctx.save();
      // Horizontal lines
      for (let gy = 0; gy <= gridN; gy++) {
        ctx.beginPath();
        for (let gx = 0; gx <= gridN; gx++) {
          const pt = points[gy][gx];
          if (gx === 0) ctx.moveTo(pt.sx, pt.sy);
          else ctx.lineTo(pt.sx, pt.sy);
        }
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Vertical lines
      for (let gx = 0; gx <= gridN; gx++) {
        ctx.beginPath();
        for (let gy = 0; gy <= gridN; gy++) {
          const pt = points[gy][gx];
          if (gy === 0) ctx.moveTo(pt.sx, pt.sy);
          else ctx.lineTo(pt.sx, pt.sy);
        }
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // Color-code grid intersections by depth
      for (let gy = 0; gy <= gridN; gy++) {
        for (let gx = 0; gx <= gridN; gx++) {
          const pt = points[gy][gx];
          const intensity = Math.min(pt.depth / 30, 1);
          const r = Math.round(59 + intensity * 190);
          const g = Math.round(130 - intensity * 60);
          const b = Math.round(246 - intensity * 100);
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, 1.5 + intensity * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fill();
        }
      }
    }

    // Draw mass (sphere)
    const massR = 12 + this.mass * 0.3;
    ctx.save();
    const grad = ctx.createRadialGradient(
      this.massX - massR * 0.3, this.massY - massR * 0.3, massR * 0.1,
      this.massX, this.massY, massR
    );
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(0.7, '#f59e0b');
    grad.addColorStop(1, '#b45309');
    ctx.beginPath();
    ctx.arc(this.massX, this.massY, massR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.restore();

    // Draw test particles
    if (this.showTestParticles) {
      for (const p of this.particles) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#34d399';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();

        // Small velocity trail
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.1, p.y - p.vy * 0.1);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Info overlay
    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 200, infoY - 5, 205, 70);
    drawText(ctx, `Mass: ${this.mass.toFixed(0)} M\u2609`, infoX, infoY + 12, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Particles: ${this.particles.length}`, infoX, infoY + 30, '#94a3b8', '12px monospace', 'right');
    drawText(ctx, 'Drag mass to reposition', infoX, infoY + 50, '#64748b', '11px monospace', 'right');

    // Equation
    drawText(ctx, 'Curvature ~ GM / (r c\u00B2)', width / 2, height - 25, '#64748b', '13px monospace', 'center');
  }

  reset(): void {
    this.massX = this.width / 2;
    this.massY = this.height / 2;
    this.time = 0;
    this.spawnParticles();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    // Reposition mass proportionally
    const ratioX = this.massX / (this.width || width);
    const ratioY = this.massY / (this.height || height);
    super.resize(width, height, pixelRatio);
    this.massX = ratioX * width;
    this.massY = ratioY * height;
  }

  // Pointer interaction for dragging mass
  onPointerDown(x: number, y: number): void {
    const dx = x - this.massX;
    const dy = y - this.massY;
    const massR = 12 + this.mass * 0.3;
    if (dx * dx + dy * dy < (massR + 20) * (massR + 20)) {
      this.dragging = true;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging) {
      this.massX = Math.max(20, Math.min(this.width - 20, x));
      this.massY = Math.max(20, Math.min(this.height - 20, y));
    }
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'mass', label: 'Mass', min: 1, max: 100, step: 1, defaultValue: 20 },
      { type: 'toggle', key: 'showGridLines', label: 'Show Grid Lines', defaultValue: true },
      { type: 'toggle', key: 'showTestParticles', label: 'Show Test Particles', defaultValue: true },
      { type: 'slider', key: 'particleCount', label: 'Particle Count', min: 1, max: 20, step: 1, defaultValue: 5 },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      mass: this.mass,
      showGridLines: this.showGridLines,
      showTestParticles: this.showTestParticles,
      particleCount: this.particleCount,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'mass':
        this.mass = value as number;
        break;
      case 'showGridLines':
        this.showGridLines = value as boolean;
        break;
      case 'showTestParticles':
        this.showTestParticles = value as boolean;
        break;
      case 'particleCount':
        this.particleCount = value as number;
        this.spawnParticles();
        break;
    }
  }
}

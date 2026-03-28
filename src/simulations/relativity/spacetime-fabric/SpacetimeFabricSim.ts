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
  private showEventHorizon = true;

  private massX = 0;
  private massY = 0;
  private draggingMass = false;

  // 3D rotation
  private rotX = 0.75; // pitch angle (0 = top-down, π/2 = edge-on)
  private rotY = 0;    // yaw angle
  private draggingView = false;
  private lastDragX = 0;
  private lastDragY = 0;

  private particles: TestParticle[] = [];
  private readonly gridSize = 100;

  // Schwarzschild radius (scaled for display)
  private get schwarzschildRadius(): number {
    return Math.sqrt(this.mass) * 3; // pixels, grows with sqrt(M)
  }

  private get isBlackHole(): boolean {
    return this.mass >= 80; // threshold for black hole visual
  }

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
        vx: -Math.sin(angle) * 80 + (Math.random() - 0.5) * 10,
        vy: Math.cos(angle) * 80 + (Math.random() - 0.5) * 10,
      });
    }
  }

  private depressionAt(px: number, py: number): number {
    const dx = px - this.massX;
    const dy = py - this.massY;
    const r = Math.sqrt(dx * dx + dy * dy);

    // Star radius: proportional to mass, large enough to span many grid cells
    const starR = this.isBlackHole ? 0 : 40 + this.mass * 1.5;

    if (this.isBlackHole) {
      // Black hole: steep 1/r funnel, capped
      return Math.min((this.mass * 100) / (r + 2), this.mass * 5);
    }

    // Star (non-black-hole):
    // Outside surface: 1/r gravitational potential
    // Inside surface: smooth parabolic bowl (uniform density interior solution)
    // Real physics: Φ_interior = -GM/(2R³)(3R² - r²) which is parabolic
    const depthSurface = (this.mass * 100) / (starR + 5);

    if (r >= starR) {
      return (this.mass * 100) / (r + 5);
    } else {
      // Parabolic interior: deepest at center, matches surface value and slope at r=starR
      // Φ(r) = Φ_surface * (3 - (r/R)²) / 2
      const t = r / starR;
      return depthSurface * (3 - t * t) / 2;
    }
  }

  update(dt: number): void {
    this.time += dt;

    if (!this.showTestParticles) return;

    const G = this.mass * 500;
    const rs = this.schwarzschildRadius;
    for (const p of this.particles) {
      const dx = this.massX - p.x;
      const dy = this.massY - p.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) + 5;

      // Gravitational acceleration
      const a = G / (distSq + 100);
      p.vx += (dx / dist) * a * dt;
      p.vy += (dy / dist) * a * dt;

      p.vx *= 0.999;
      p.vy *= 0.999;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Black hole: particles crossing event horizon disappear
      if (this.isBlackHole && dist < rs * 2) {
        p.x = -9999;
        p.y = -9999;
        p.vx = 0;
        p.vy = 0;
        continue;
      }

      // Wrap around if too far
      const margin = 50;
      if (p.x < -margin) p.x = this.width + margin;
      if (p.x > this.width + margin) p.x = -margin;
      if (p.y < -margin) p.y = this.height + margin;
      if (p.y > this.height + margin) p.y = -margin;
    }
  }

  // 3D projection: world (wx, wy, wz) → screen (sx, sy)
  private project(wx: number, wy: number, wz: number): { sx: number; sy: number; depth: number } {
    const cx = this.width / 2;
    const cy = this.height / 2;

    // Center
    let x = wx - cx;
    let y = wy - cy;
    let z = wz;

    // Rotate around Y axis (yaw)
    const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    x = x1; z = z1;

    // Rotate around X axis (pitch)
    const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
    const y1 = y * cosX - z * sinX;
    const z2 = y * sinX + z * cosX;
    y = y1;

    return { sx: cx + x, sy: cy + y, depth: z2 };
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0a0e1a');

    const gridN = this.gridSize;
    const gridSpan = Math.max(width, height) * 1.3; // extra-large to cover all particles
    const cellSize = gridSpan / gridN;
    const cx = width / 2;
    const cy = height / 2;

    // Compute grid points with depression mapped to Z
    const points: { sx: number; sy: number; depth: number; depression: number }[][] = [];
    for (let gy = 0; gy <= gridN; gy++) {
      points[gy] = [];
      for (let gx = 0; gx <= gridN; gx++) {
        const wx = cx + (gx - gridN / 2) * cellSize;
        const wy = cy + (gy - gridN / 2) * cellSize;
        const dep = this.depressionAt(wx, wy);
        const wz = -dep * 2.0; // depression = negative Z (downward)

        const p = this.project(wx, wy, wz);
        points[gy][gx] = { ...p, depression: dep };
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
        const intensity = Math.min(0.5, 0.15 + points[gy][Math.floor(gridN / 2)].depression / 200);
        ctx.strokeStyle = `rgba(96, 165, 250, ${intensity})`;
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
        const intensity = Math.min(0.5, 0.15 + points[Math.floor(gridN / 2)][gx].depression / 200);
        ctx.strokeStyle = `rgba(96, 165, 250, ${intensity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Event horizon ring (for black holes)
    if (this.showEventHorizon && this.isBlackHole) {
      const rs = this.schwarzschildRadius * 3;
      // Draw event horizon as a circle projected into 3D
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        const ehx = this.massX + Math.cos(angle) * rs;
        const ehy = this.massY + Math.sin(angle) * rs;
        const dep = this.depressionAt(ehx, ehy);
        const p = this.project(ehx, ehy, -dep * 2.0);
        if (i === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.closePath();

      // Black hole interior
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Accretion disk glow
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        const adx = this.massX + Math.cos(angle) * rs * 1.5;
        const ady = this.massY + Math.sin(angle) * rs * 1.5;
        const dep = this.depressionAt(adx, ady);
        const p = this.project(adx, ady, -dep * 2.0);
        if (i === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Label
      const bhP = this.project(this.massX, this.massY - rs * 2, 0);
      drawText(ctx, 'EVENT HORIZON', bhP.sx, bhP.sy - 15, '#ef4444', 'bold 12px system-ui', 'center');
      drawText(ctx, `r_s = ${rs.toFixed(0)} px`, bhP.sx, bhP.sy, '#94a3b8', '11px monospace', 'center');
    }

    // Mass sphere (only if not a black hole)
    if (!this.isBlackHole) {
      const massR = 12 + this.mass * 0.3;
      const mp = this.project(this.massX, this.massY, 0);
      ctx.save();
      const grad = ctx.createRadialGradient(
        mp.sx - massR * 0.3, mp.sy - massR * 0.3, massR * 0.1,
        mp.sx, mp.sy, massR
      );
      grad.addColorStop(0, '#fbbf24');
      grad.addColorStop(0.7, '#f59e0b');
      grad.addColorStop(1, '#b45309');
      ctx.beginPath();
      ctx.arc(mp.sx, mp.sy, massR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.restore();
    }

    // Test particles
    if (this.showTestParticles) {
      for (const p of this.particles) {
        const pp = this.project(p.x, p.y, 0);
        ctx.save();
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#34d399';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }
    }

    // Info overlay
    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 220, infoY - 5, 225, this.isBlackHole ? 90 : 70);
    drawText(ctx, `Mass: ${this.mass.toFixed(0)} M\u2609`, infoX, infoY + 12, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, this.isBlackHole ? 'Black Hole' : 'Massive Object', infoX, infoY + 30, this.isBlackHole ? '#ef4444' : '#f59e0b', 'bold 12px monospace', 'right');
    drawText(ctx, 'Drag background to rotate', infoX, infoY + 48, '#64748b', '11px monospace', 'right');
    if (this.isBlackHole) {
      drawText(ctx, `Schwarzschild R = ${this.schwarzschildRadius.toFixed(1)}`, infoX, infoY + 66, '#94a3b8', '11px monospace', 'right');
    }

    drawText(ctx, 'G\u03BC\u03BD = 8\u03C0G/c\u2074 T\u03BC\u03BD', width / 2, height - 25, '#64748b', '13px monospace', 'center');
  }

  reset(): void {
    this.massX = this.width / 2;
    this.massY = this.height / 2;
    this.rotX = 0.75;
    this.rotY = 0;
    this.time = 0;
    this.spawnParticles();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    const ratioX = this.massX / (this.width || width);
    const ratioY = this.massY / (this.height || height);
    super.resize(width, height, pixelRatio);
    this.massX = ratioX * width;
    this.massY = ratioY * height;
  }

  onPointerDown(x: number, y: number): void {
    // Check if clicking on the mass
    const dx = x - this.massX;
    const dy = y - this.massY;
    const massR = this.isBlackHole ? this.schwarzschildRadius * 3 : 12 + this.mass * 0.3;
    if (dx * dx + dy * dy < (massR + 20) * (massR + 20)) {
      this.draggingMass = true;
    } else {
      // Drag to rotate view
      this.draggingView = true;
      this.lastDragX = x;
      this.lastDragY = y;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.draggingMass) {
      this.massX = Math.max(20, Math.min(this.width - 20, x));
      this.massY = Math.max(20, Math.min(this.height - 20, y));
    } else if (this.draggingView) {
      const dx = x - this.lastDragX;
      const dy = y - this.lastDragY;
      this.rotY += dx * 0.005;
      this.rotX += dy * 0.005;
      // Clamp pitch
      this.rotX = Math.max(0.1, Math.min(1.4, this.rotX));
      this.lastDragX = x;
      this.lastDragY = y;
    }
  }

  onPointerUp(): void {
    this.draggingMass = false;
    this.draggingView = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'mass', label: 'Mass (M\u2609)', min: 1, max: 200, step: 1, defaultValue: 20 },
      { type: 'toggle', key: 'showGridLines', label: 'Spacetime Grid', defaultValue: true },
      { type: 'toggle', key: 'showTestParticles', label: 'Test Particles', defaultValue: true },
      { type: 'slider', key: 'particleCount', label: 'Particle Count', min: 1, max: 20, step: 1, defaultValue: 5 },
      { type: 'toggle', key: 'showEventHorizon', label: 'Event Horizon', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      mass: this.mass,
      showGridLines: this.showGridLines,
      showTestParticles: this.showTestParticles,
      particleCount: this.particleCount,
      showEventHorizon: this.showEventHorizon,
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
      case 'showEventHorizon':
        this.showEventHorizon = value as boolean;
        break;
    }
  }
}

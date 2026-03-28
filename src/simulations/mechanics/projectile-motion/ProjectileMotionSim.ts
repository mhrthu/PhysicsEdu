import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawArrow, drawGrid, drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  landed: boolean;
}

export default class ProjectileMotionSim extends SimulationEngine {
  private angle = 45;
  private launchSpeed = 25;
  private gravity = 9.81;
  private showVectors = true;
  private showTrace = true;
  private showDecomposition = true;
  private projectiles: Projectile[] = [];
  private groundY = 0;
  private scale = 1;
  private originX = 80;
  private originY = 0;

  setup(): void {
    this.groundY = this.height - 60;
    this.originY = this.groundY;
    this.scale = Math.min(this.width, this.height) / 400;
    this.launch();
  }

  private launch(): void {
    const rad = (this.angle * Math.PI) / 180;
    this.projectiles = [{
      x: 0,
      y: 0,
      vx: this.launchSpeed * Math.cos(rad),
      vy: -this.launchSpeed * Math.sin(rad),
      trail: [{ x: 0, y: 0 }],
      landed: false,
    }];
    this.time = 0;
  }

  update(dt: number): void {
    this.time += dt;
    for (const p of this.projectiles) {
      if (p.landed) continue;
      p.vy += this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.y >= 0 && p.trail.length > 2) {
        p.y = 0;
        p.vy = 0;
        p.vx = 0;
        p.landed = true;
      }
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 50);

    const ox = this.originX;
    const oy = this.originY;
    const s = this.scale * 8;

    // Ground
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, this.groundY, width, height - this.groundY);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(width, this.groundY);
    ctx.stroke();

    // Axis labels
    for (let d = 0; d * s + ox < width; d += 5) {
      const x = ox + d * s;
      drawText(ctx, `${d}m`, x, oy + 20, '#64748b', '10px system-ui', 'center');
      drawDashedLine(ctx, x, oy - 5, x, oy + 5, 'rgba(255,255,255,0.1)', 1, [2, 2]);
    }
    for (let d = 5; oy - d * s > 0; d += 5) {
      const y = oy - d * s;
      drawText(ctx, `${d}m`, ox - 10, y, '#64748b', '10px system-ui', 'right');
      drawDashedLine(ctx, ox - 5, y, ox + 5, y, 'rgba(255,255,255,0.1)', 1, [2, 2]);
    }

    for (const p of this.projectiles) {
      const px = ox + p.x * s;
      const py = oy + p.y * s;

      // Trace
      if (this.showTrace && p.trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < p.trail.length; i++) {
          const tx = ox + p.trail[i].x * s;
          const ty = oy + p.trail[i].y * s;
          if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }

      // Theoretical trace
      if (this.showTrace) {
        const rad = (this.angle * Math.PI) / 180;
        const v0x = this.launchSpeed * Math.cos(rad);
        const v0y = -this.launchSpeed * Math.sin(rad);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(147, 51, 234, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let t = 0; t < 20; t += 0.05) {
          const tx = ox + (v0x * t) * s;
          const ty = oy + (v0y * t + 0.5 * this.gravity * t * t) * s;
          if (ty > oy) break;
          if (t === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Velocity decomposition
      if (this.showDecomposition && !p.landed) {
        const vScale = 2;
        // Horizontal component
        drawArrow(ctx, px, py, px + p.vx * vScale, py, '#22c55e', 2, 8);
        // Vertical component
        drawArrow(ctx, px, py, px, py + p.vy * vScale, '#f59e0b', 2, 8);
      }

      // Velocity vector
      if (this.showVectors && !p.landed) {
        const vScale = 2;
        drawArrow(ctx, px, py, px + p.vx * vScale, py + p.vy * vScale, '#ef4444', 2.5, 10);
      }

      // Ball
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Landing marker
      if (p.landed) {
        drawText(ctx, `Range: ${p.x.toFixed(1)}m`, px, py - 20, '#22c55e', '12px system-ui', 'center');
      }
    }

    // Info overlay
    const rad = (this.angle * Math.PI) / 180;
    const maxH = (this.launchSpeed * this.launchSpeed * Math.sin(rad) * Math.sin(rad)) / (2 * this.gravity);
    const range = (this.launchSpeed * this.launchSpeed * Math.sin(2 * rad)) / this.gravity;
    const flightTime = (2 * this.launchSpeed * Math.sin(rad)) / this.gravity;

    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(infoX - 190, infoY - 5, 195, 80);
    drawText(ctx, `Max Height: ${maxH.toFixed(1)} m`, infoX, infoY + 10, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Range: ${range.toFixed(1)} m`, infoX, infoY + 28, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Flight Time: ${flightTime.toFixed(2)} s`, infoX, infoY + 46, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Time: ${this.time.toFixed(2)} s`, infoX, infoY + 64, '#94a3b8', '11px monospace', 'right');

    // Launch indicator
    const launchLen = 40;
    const lx = ox + launchLen * Math.cos(rad);
    const ly = oy - launchLen * Math.sin(rad);
    ctx.beginPath();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(ox, oy);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    drawText(ctx, `${this.angle}\u00B0`, ox + 45, oy - 15, '#94a3b8', '11px system-ui', 'left');
  }

  reset(): void {
    this.launch();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.groundY = this.height - 60;
    this.originY = this.groundY;
    this.scale = Math.min(this.width, this.height) / 400;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'angle', label: 'Launch Angle', min: 5, max: 85, step: 1, defaultValue: 45, unit: '\u00B0' },
      { type: 'slider', key: 'speed', label: 'Initial Speed', min: 5, max: 50, step: 1, defaultValue: 25, unit: 'm/s' },
      { type: 'slider', key: 'gravity', label: 'Gravity', min: 1, max: 25, step: 0.1, defaultValue: 9.81, unit: 'm/s\u00B2' },
      { type: 'toggle', key: 'showVectors', label: 'Velocity Vector', defaultValue: true },
      { type: 'toggle', key: 'showDecomposition', label: 'V\u2093/V\u1D67 Decomposition', defaultValue: true },
      { type: 'toggle', key: 'showTrace', label: 'Trajectory Trace', defaultValue: true },
      { type: 'button', key: 'launch', label: '\uD83D\uDE80 Launch' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      angle: this.angle,
      speed: this.launchSpeed,
      gravity: this.gravity,
      showVectors: this.showVectors,
      showDecomposition: this.showDecomposition,
      showTrace: this.showTrace,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'angle': this.angle = value as number; this.launch(); break;
      case 'speed': this.launchSpeed = value as number; this.launch(); break;
      case 'gravity': this.gravity = value as number; this.launch(); break;
      case 'showVectors': this.showVectors = value as boolean; break;
      case 'showDecomposition': this.showDecomposition = value as boolean; break;
      case 'showTrace': this.showTrace = value as boolean; break;
      case 'launch': this.launch(); break;
    }
  }
}

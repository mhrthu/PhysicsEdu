import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { verletStep } from '@/engine/math/numerical.ts';
import { clearCanvas, drawGrid, drawArrow, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

export default class OrbitalMechanicsSim extends SimulationEngine {
  private planetMass = 5000;
  private initialVelocity = 6;
  private showTrace = true;
  private showVelocity = true;

  // Orbiter state (in sim coordinates, center of canvas = star)
  private ox = 0;
  private oy = 0;
  private ovx = 0;
  private ovy = 0;

  private trail: { x: number; y: number }[] = [];
  private maxTrail = 800;

  // Interaction
  private dragging = false;

  // Layout
  private cx = 0;
  private cy = 0;
  private G = 1;

  setup(): void {
    this.time = 0;
    this.cx = this.width / 2;
    this.cy = this.height / 2;

    // Start orbiter to the right
    this.ox = 150;
    this.oy = 0;
    this.ovx = 0;
    this.ovy = -this.initialVelocity;
    this.trail = [];
  }

  update(dt: number): void {
    if (this.dragging) return;

    const GM = this.G * this.planetMass;

    const acc = (pos: number[]): number[] => {
      const [x, y] = pos;
      const r2 = x * x + y * y;
      const r = Math.sqrt(r2);
      if (r < 10) return [0, 0]; // prevent singularity
      const a = -GM / r2;
      return [a * x / r, a * y / r];
    };

    const result = verletStep(
      [this.ox, this.oy],
      [this.ovx, this.ovy],
      acc,
      dt
    );

    this.ox = result.pos[0];
    this.oy = result.pos[1];
    this.ovx = result.vel[0];
    this.ovy = result.vel[1];

    // Record trail
    this.trail.push({ x: this.ox, y: this.oy });
    if (this.trail.length > this.maxTrail) {
      this.trail.shift();
    }

    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);

    // Star field background dots
    ctx.save();
    const seed = 42;
    for (let i = 0; i < 80; i++) {
      const sx = ((seed * (i + 1) * 7919) % width);
      const sy = ((seed * (i + 1) * 104729) % height);
      const brightness = 0.1 + (i % 5) * 0.08;
      ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.restore();

    this.cx = width / 2;
    this.cy = height / 2;

    // Draw orbit trace
    if (this.showTrace && this.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = i / this.trail.length;
        ctx.strokeStyle = `rgba(6,182,212,${alpha * 0.7})`;
        ctx.lineWidth = 1 + alpha;
        ctx.beginPath();
        ctx.moveTo(this.cx + this.trail[i - 1].x, this.cy + this.trail[i - 1].y);
        ctx.lineTo(this.cx + this.trail[i].x, this.cy + this.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw central star with glow
    ctx.save();
    const starR = 18;
    const glow = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, starR * 4);
    glow.addColorStop(0, 'rgba(251,191,36,0.4)');
    glow.addColorStop(0.5, 'rgba(251,191,36,0.1)');
    glow.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, starR * 4, 0, Math.PI * 2);
    ctx.fill();

    const starGrad = ctx.createRadialGradient(this.cx - 4, this.cy - 4, 0, this.cx, this.cy, starR);
    starGrad.addColorStop(0, '#fef3c7');
    starGrad.addColorStop(0.6, '#fbbf24');
    starGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, starR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw orbiter
    const orbX = this.cx + this.ox;
    const orbY = this.cy + this.oy;
    const orbR = 8;

    ctx.save();
    const orbGrad = ctx.createRadialGradient(orbX - 2, orbY - 2, 0, orbX, orbY, orbR);
    orbGrad.addColorStop(0, '#93c5fd');
    orbGrad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Velocity vector
    if (this.showVelocity) {
      const vScale = 0.5;
      drawArrow(ctx, orbX, orbY, orbX + this.ovx * vScale, orbY + this.ovy * vScale, '#22c55e', 2, 7);
      drawText(ctx, 'v', orbX + this.ovx * vScale + 8, orbY + this.ovy * vScale, '#22c55e', '12px system-ui');
    }

    // Orbit info
    const r = Math.sqrt(this.ox * this.ox + this.oy * this.oy);
    const v = Math.sqrt(this.ovx * this.ovx + this.ovy * this.ovy);
    const GM = this.G * this.planetMass;
    const KE = 0.5 * v * v;
    const PE = -GM / Math.max(r, 1);
    const totalE = KE + PE;

    let orbitType = 'Elliptical';
    if (totalE > 0.1) orbitType = 'Hyperbolic';
    else if (totalE > -0.1) orbitType = 'Parabolic';
    else {
      const vCirc = Math.sqrt(GM / Math.max(r, 1));
      if (Math.abs(v - vCirc) / vCirc < 0.05) orbitType = 'Circular';
    }

    drawText(ctx, `Orbit: ${orbitType}`, 16, height - 80, '#06b6d4', 'bold 14px system-ui');
    drawText(ctx, `r = ${r.toFixed(1)}   v = ${v.toFixed(1)}`, 16, height - 58, '#e2e8f0', '13px system-ui');
    drawText(ctx, `E = KE + PE = ${KE.toFixed(1)} + (${PE.toFixed(1)}) = ${totalE.toFixed(1)}`, 16, height - 36, '#94a3b8', '13px system-ui');
    drawText(ctx, `t = ${this.time.toFixed(2)} s`, 16, height - 14, '#64748b', '12px system-ui');
  }

  reset(): void {
    this.setup();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'planetMass', label: 'Star Mass', min: 1000, max: 20000, step: 100, defaultValue: 5000 },
      { type: 'slider', key: 'initialVelocity', label: 'Initial Velocity', min: 1, max: 15, step: 0.1, defaultValue: 6 },
      { type: 'toggle', key: 'showTrace', label: 'Orbit Trace', defaultValue: true },
      { type: 'toggle', key: 'showVelocity', label: 'Velocity Vectors', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      planetMass: this.planetMass,
      initialVelocity: this.initialVelocity,
      showTrace: this.showTrace,
      showVelocity: this.showVelocity,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'planetMass': this.planetMass = value as number; this.reset(); break;
      case 'initialVelocity':
        this.initialVelocity = value as number;
        this.reset();
        break;
      case 'showTrace': this.showTrace = value as boolean; break;
      case 'showVelocity': this.showVelocity = value as boolean; break;
    }
  }

  onPointerDown(x: number, y: number): void {
    const orbX = this.cx + this.ox;
    const orbY = this.cy + this.oy;
    const dx = x - orbX;
    const dy = y - orbY;
    if (Math.sqrt(dx * dx + dy * dy) < 25) {
      this.dragging = true;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    this.ox = x - this.cx;
    this.oy = y - this.cy;
    this.trail = [];
  }

  onPointerUp(_x: number, _y: number): void {
    this.dragging = false;
  }
}

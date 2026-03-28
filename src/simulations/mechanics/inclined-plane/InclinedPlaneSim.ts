import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { clearCanvas, drawGrid, drawArrow, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

export default class InclinedPlaneSim extends SimulationEngine {
  private angle = 30;
  private mass = 5;
  private friction = 0.3;
  private showForces = true;
  private gravity = 9.81;

  // Block state
  private blockPos = 0; // distance along ramp from bottom
  private blockVel = 0;
  private rampLength = 0;
  private sliding = false;

  setup(): void {
    this.time = 0;
    this.computeRamp();
    this.blockPos = this.rampLength * 0.7;
    this.blockVel = 0;
    this.sliding = false;
  }

  private computeRamp(): void {
    this.rampLength = Math.min(this.width, this.height) * 0.7;
  }

  update(dt: number): void {
    this.computeRamp();
    const angleRad = this.angle * Math.PI / 180;
    const g = this.gravity;
    const mu = this.friction;

    const gParallel = g * Math.sin(angleRad);
    const gNormal = g * Math.cos(angleRad);
    const frictionAcc = mu * gNormal;

    // Net acceleration down the ramp
    const netAcc = gParallel - frictionAcc;

    if (netAcc > 0.001 || Math.abs(this.blockVel) > 0.01) {
      this.sliding = true;
      // Block accelerates down
      let acc = gParallel;
      if (this.blockVel > 0.01) {
        acc = gParallel - frictionAcc; // moving down (positive vel = down ramp from top)
      } else if (this.blockVel < -0.01) {
        acc = gParallel + frictionAcc; // moving up
      } else {
        acc = netAcc > 0 ? netAcc : 0;
      }

      this.blockVel += acc * dt;
      this.blockPos -= this.blockVel * dt; // pos measured from bottom

      // Clamp
      if (this.blockPos <= 0) {
        this.blockPos = 0;
        this.blockVel = 0;
      }
      if (this.blockPos >= this.rampLength) {
        this.blockPos = this.rampLength * 0.7;
        this.blockVel = 0;
      }
    } else {
      this.sliding = false;
      this.blockVel = 0;
    }

    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);
    this.computeRamp();

    const angleRad = this.angle * Math.PI / 180;
    const rampLen = this.rampLength;

    // Ramp geometry
    const baseX = width * 0.15;
    const baseY = height * 0.82;
    const topX = baseX + rampLen * Math.cos(angleRad);
    const topY = baseY - rampLen * Math.sin(angleRad);

    // Draw ground
    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(width, baseY);
    ctx.stroke();

    // Hatching under ground
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x - 10, baseY + 12);
      ctx.stroke();
    }
    ctx.restore();

    // Draw ramp
    ctx.save();
    const rampGrad = ctx.createLinearGradient(baseX, baseY, topX, topY);
    rampGrad.addColorStop(0, '#334155');
    rampGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = rampGrad;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(topX, topY);
    ctx.lineTo(topX, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Angle arc
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(baseX, baseY, 50, -angleRad, 0, false);
    ctx.stroke();
    ctx.restore();
    drawText(ctx, `${this.angle}\u00b0`, baseX + 55, baseY - 15, '#fbbf24', '13px system-ui');

    // Block position on ramp
    const blockSize = Math.max(24, Math.min(40, this.mass * 2.5));
    const dist = this.blockPos;
    const bx = baseX + dist * Math.cos(angleRad);
    const by = baseY - dist * Math.sin(angleRad);

    // Draw block
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-angleRad);

    const grad = ctx.createLinearGradient(0, -blockSize, 0, 0);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.fillRect(-blockSize / 2, -blockSize, blockSize, blockSize);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-blockSize / 2, -blockSize, blockSize, blockSize);

    // Mass label on block
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.mass}kg`, 0, -blockSize / 2);

    ctx.restore();

    // Force vectors
    if (this.showForces) {
      this.renderForces(bx, by - blockSize * Math.cos(angleRad) / 2, angleRad, blockSize);
    }

    // Status text
    const gPar = this.gravity * Math.sin(angleRad);
    const fGravPar = this.mass * gPar;
    const fFricKinetic = this.friction * this.mass * this.gravity * Math.cos(angleRad);
    const fFricDisplay = this.sliding ? fFricKinetic : Math.min(fFricKinetic, fGravPar);
    const fNet = fGravPar - fFricKinetic;

    drawText(ctx, `F\u2091 = mg sin\u03b8 = ${fGravPar.toFixed(1)} N`, 16, height - 80, '#ef4444', '13px system-ui');
    drawText(ctx, `F\u2099 = mg cos\u03b8 = ${(this.mass * this.gravity * Math.cos(angleRad)).toFixed(1)} N`, 16, height - 58, '#3b82f6', '13px system-ui');
    drawText(ctx, `f = ${this.sliding ? '\u03bcN' : 'min(\u03bcN, mg sin\u03b8)'} = ${fFricDisplay.toFixed(1)} N`, 16, height - 36, '#a855f7', '13px system-ui');
    drawText(ctx, this.sliding ? `Sliding! Net = ${fNet.toFixed(1)} N` : `Static: friction balances gravity`, 16, height - 14, this.sliding ? '#fbbf24' : '#22c55e', '13px system-ui');
  }

  private renderForces(bx: number, by: number, angleRad: number, blockSize: number): void {
    const { ctx, mass, gravity, friction } = this;
    const fScale = 1.5;

    // Center of block (approximate world position)
    const cx = bx;
    const cy = by;

    // Gravity (straight down)
    const fG = mass * gravity * fScale;
    drawArrow(ctx, cx, cy, cx, cy + fG, '#ef4444', 2.5, 8);
    drawText(ctx, 'mg', cx + 8, cy + fG + 5, '#ef4444', '11px system-ui');

    // Normal force (perpendicular to ramp surface, pointing away)
    const N = mass * gravity * Math.cos(angleRad);
    const nLen = N * fScale;
    const nx = -Math.sin(angleRad);
    const ny = -Math.cos(angleRad);
    drawArrow(ctx, cx, cy, cx + nx * nLen, cy + ny * nLen, '#3b82f6', 2.5, 8);
    drawText(ctx, 'N', cx + nx * nLen + 8, cy + ny * nLen, '#3b82f6', '11px system-ui');

    // Friction: kinetic = μN always; static ≤ driving force (balances gravity)
    const fGravParallel = mass * gravity * Math.sin(angleRad);
    const fFricKinetic = friction * N;
    const fFric = this.sliding ? fFricKinetic : Math.min(fFricKinetic, fGravParallel);
    const fLen = fFric * fScale;
    const fx = Math.cos(angleRad);
    const fy = -Math.sin(angleRad);
    if (fFric > 0.01) {
      drawArrow(ctx, cx, cy, cx + fx * fLen, cy + fy * fLen, '#a855f7', 2.5, 8);
      drawText(ctx, 'f', cx + fx * fLen + 8, cy + fy * fLen, '#a855f7', '11px system-ui');
    }
  }

  reset(): void {
    this.computeRamp();
    this.blockPos = this.rampLength * 0.7;
    this.blockVel = 0;
    this.sliding = false;
    this.time = 0;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'angle', label: 'Ramp Angle', min: 5, max: 80, step: 1, defaultValue: 30, unit: '\u00b0' },
      { type: 'slider', key: 'mass', label: 'Mass', min: 1, max: 20, step: 0.5, defaultValue: 5, unit: 'kg' },
      { type: 'slider', key: 'friction', label: 'Friction Coefficient', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
      { type: 'toggle', key: 'showForces', label: 'Force Vectors', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      angle: this.angle,
      mass: this.mass,
      friction: this.friction,
      showForces: this.showForces,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'angle': this.angle = value as number; this.reset(); break;
      case 'mass': this.mass = value as number; break;
      case 'friction': this.friction = value as number; break;
      case 'showForces': this.showForces = value as boolean; break;
    }
  }
}

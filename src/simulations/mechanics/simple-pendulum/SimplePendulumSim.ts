import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { rk4Step } from '@/engine/math/numerical.ts';
import { clearCanvas, drawGrid, drawArrow, drawText, drawDashedLine } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

export default class SimplePendulumSim extends SimulationEngine {
  private length = 2.0;
  private mass = 1.0;
  private gravity = 9.81;
  private showForces = true;
  private showEnergy = true;

  // State: [theta, omega]
  private theta = Math.PI / 4;
  private omega = 0;
  private initialTheta = Math.PI / 4;

  // Interaction
  private dragging = false;

  // Derived display
  private pivotX = 0;
  private pivotY = 0;
  private scale = 0;

  setup(): void {
    this.theta = this.initialTheta;
    this.omega = 0;
    this.time = 0;
    this.computeLayout();
  }

  private computeLayout(): void {
    this.pivotX = this.width / 2;
    this.pivotY = this.height * 0.2;
    this.scale = Math.min(this.width, this.height) * 0.12;
  }

  update(dt: number): void {
    if (this.dragging) return;

    const g = this.gravity;
    const L = this.length;

    const derivatives = (state: number[], _t: number): number[] => {
      const [th, om] = state;
      return [om, -(g / L) * Math.sin(th)];
    };

    const state = rk4Step([this.theta, this.omega], this.time, dt, derivatives);
    this.theta = state[0];
    this.omega = state[1];
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);
    this.computeLayout();

    const { pivotX, pivotY, scale, length, theta, mass, gravity } = this;

    const bobX = pivotX + Math.sin(theta) * length * scale;
    const bobY = pivotY + Math.cos(theta) * length * scale;
    const bobRadius = Math.max(8, Math.min(20, mass * 4));

    // Draw pivot
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(pivotX - 30, pivotY - 6, 60, 6);
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.restore();

    // Draw string
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.restore();

    // Draw dashed equilibrium line
    drawDashedLine(ctx, pivotX, pivotY, pivotX, pivotY + length * scale + 30, 'rgba(148,163,184,0.3)', 1);

    // Draw angle arc
    if (Math.abs(theta) > 0.02) {
      const arcR = 40;
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const startAngle = Math.PI / 2 - Math.abs(theta);
      const endAngle = Math.PI / 2;
      if (theta > 0) {
        ctx.arc(pivotX, pivotY, arcR, Math.PI / 2 - theta, Math.PI / 2, false);
      } else {
        ctx.arc(pivotX, pivotY, arcR, Math.PI / 2, Math.PI / 2 - theta, false);
      }
      ctx.stroke();
      ctx.restore();

      const angleDeg = (theta * 180 / Math.PI).toFixed(1);
      drawText(ctx, `${angleDeg}\u00b0`, pivotX + (theta > 0 ? -50 : 25), pivotY + 50, '#fbbf24', '13px system-ui');
    }

    // Force vectors
    if (this.showForces) {
      const fScale = 30;

      // Gravity (downward)
      const fGravity = mass * gravity;
      drawArrow(ctx, bobX, bobY, bobX, bobY + fGravity * fScale / 10, '#ef4444', 2.5, 8);
      drawText(ctx, 'mg', bobX + 8, bobY + fGravity * fScale / 10, '#ef4444', '12px system-ui');

      // Tension (along string toward pivot)
      const tension = mass * gravity * Math.cos(theta) + mass * length * this.omega * this.omega;
      const tLen = tension * fScale / 10;
      const tx = pivotX - bobX;
      const ty = pivotY - bobY;
      const tMag = Math.sqrt(tx * tx + ty * ty);
      if (tMag > 0) {
        drawArrow(ctx, bobX, bobY, bobX + tx / tMag * tLen, bobY + ty / tMag * tLen, '#3b82f6', 2.5, 8);
        drawText(ctx, 'T', bobX + tx / tMag * tLen + 8, bobY + ty / tMag * tLen, '#3b82f6', '12px system-ui');
      }
    }

    // Bob with gradient
    ctx.save();
    const grad = ctx.createRadialGradient(bobX - bobRadius * 0.3, bobY - bobRadius * 0.3, 0, bobX, bobY, bobRadius);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Energy bar
    if (this.showEnergy) {
      this.renderEnergyBar();
    }

    // Info text
    const period = 2 * Math.PI * Math.sqrt(this.length / this.gravity);
    drawText(ctx, `T = 2\u03c0\u221a(L/g) = ${period.toFixed(3)} s`, 16, height - 60, '#e2e8f0', '14px system-ui');
    drawText(ctx, `\u03b8 = ${(this.theta * 180 / Math.PI).toFixed(1)}\u00b0   \u03c9 = ${this.omega.toFixed(2)} rad/s`, 16, height - 36, '#94a3b8', '13px system-ui');
    drawText(ctx, `t = ${this.time.toFixed(2)} s`, 16, height - 14, '#64748b', '12px system-ui');
  }

  private renderEnergyBar(): void {
    const { ctx, width, length, mass, gravity, theta, omega } = this;

    const barX = width - 50;
    const barY = 60;
    const barW = 24;
    const barH = 200;

    const h = length * (1 - Math.cos(theta));
    const PE = mass * gravity * h;
    const KE = 0.5 * mass * (length * omega) ** 2;
    const totalE = PE + KE;

    if (totalE < 0.0001) return;

    const keFrac = KE / totalE;
    const peFrac = PE / totalE;

    // Background
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 30, 6);
    ctx.fill();
    ctx.stroke();

    // KE (bottom, blue)
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(barX, barY + barH * peFrac, barW, barH * keFrac);

    // PE (top, red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(barX, barY, barW, barH * peFrac);

    ctx.restore();

    drawText(ctx, 'KE', barX + barW / 2, barY + barH + 14, '#3b82f6', '11px system-ui', 'center');
    drawText(ctx, 'PE', barX + barW / 2, barY - 12, '#ef4444', '11px system-ui', 'center');
  }

  reset(): void {
    this.theta = this.initialTheta;
    this.omega = 0;
    this.time = 0;
    this.dragging = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'length', label: 'String Length', min: 0.5, max: 5, step: 0.1, defaultValue: 2, unit: 'm' },
      { type: 'slider', key: 'mass', label: 'Mass', min: 0.1, max: 10, step: 0.1, defaultValue: 1, unit: 'kg' },
      { type: 'slider', key: 'gravity', label: 'Gravity', min: 1, max: 25, step: 0.1, defaultValue: 9.81, unit: 'm/s\u00b2' },
      { type: 'toggle', key: 'showForces', label: 'Force Vectors', defaultValue: true },
      { type: 'toggle', key: 'showEnergy', label: 'Energy Bar', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      length: this.length,
      mass: this.mass,
      gravity: this.gravity,
      showForces: this.showForces,
      showEnergy: this.showEnergy,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'length': this.length = value as number; break;
      case 'mass': this.mass = value as number; break;
      case 'gravity': this.gravity = value as number; break;
      case 'showForces': this.showForces = value as boolean; break;
      case 'showEnergy': this.showEnergy = value as boolean; break;
    }
  }

  onPointerDown(x: number, y: number): void {
    this.computeLayout();
    const bobX = this.pivotX + Math.sin(this.theta) * this.length * this.scale;
    const bobY = this.pivotY + Math.cos(this.theta) * this.length * this.scale;
    const dx = x - bobX;
    const dy = y - bobY;
    if (Math.sqrt(dx * dx + dy * dy) < 30) {
      this.dragging = true;
      this.omega = 0;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    this.computeLayout();
    const dx = x - this.pivotX;
    const dy = y - this.pivotY;
    this.theta = Math.atan2(dx, dy);
    this.initialTheta = this.theta;
  }

  onPointerUp(_x: number, _y: number): void {
    this.dragging = false;
  }
}

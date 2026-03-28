import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { rk4Step } from '@/engine/math/numerical.ts';
import { clearCanvas, drawGrid, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

export default class DoublePendulumSim extends SimulationEngine {
  private L1 = 1.5;
  private L2 = 1.5;
  private m1 = 1.0;
  private m2 = 1.0;
  private showTrail = true;
  private showPhaseSpace = false;
  private gravity = 9.81;

  // State: [theta1, omega1, theta2, omega2]
  private theta1 = Math.PI / 2;
  private omega1 = 0;
  private theta2 = Math.PI / 2;
  private omega2 = 0;

  // Trail
  private trail: { x: number; y: number }[] = [];
  private maxTrail = 1500;

  // Phase space
  private phaseHistory: { th1: number; om1: number; th2: number; om2: number }[] = [];
  private maxPhase = 500;

  // Layout
  private pivotX = 0;
  private pivotY = 0;
  private scale = 0;

  setup(): void {
    this.time = 0;
    this.theta1 = Math.PI / 2;
    this.omega1 = 0;
    this.theta2 = Math.PI / 2;
    this.omega2 = 0;
    this.trail = [];
    this.phaseHistory = [];
    this.computeLayout();
  }

  private computeLayout(): void {
    this.pivotX = this.showPhaseSpace ? this.width * 0.3 : this.width / 2;
    this.pivotY = this.height * 0.3;
    this.scale = Math.min(this.width * (this.showPhaseSpace ? 0.15 : 0.18), this.height * 0.15);
  }

  update(dt: number): void {
    const { L1, L2, m1, m2, gravity: g } = this;

    // Coupled ODEs for double pendulum
    const derivatives = (state: number[], _t: number): number[] => {
      const [th1, om1, th2, om2] = state;
      const dth = th1 - th2;
      const sinDth = Math.sin(dth);
      const cosDth = Math.cos(dth);

      const den = 2 * m1 + m2 - m2 * Math.cos(2 * dth);

      const alpha1 = (
        -g * (2 * m1 + m2) * Math.sin(th1)
        - m2 * g * Math.sin(th1 - 2 * th2)
        - 2 * sinDth * m2 * (om2 * om2 * L2 + om1 * om1 * L1 * cosDth)
      ) / (L1 * den);

      const alpha2 = (
        2 * sinDth * (
          om1 * om1 * L1 * (m1 + m2)
          + g * (m1 + m2) * Math.cos(th1)
          + om2 * om2 * L2 * m2 * cosDth
        )
      ) / (L2 * den);

      return [om1, alpha1, om2, alpha2];
    };

    const state = rk4Step(
      [this.theta1, this.omega1, this.theta2, this.omega2],
      this.time, dt, derivatives
    );

    this.theta1 = state[0];
    this.omega1 = state[1];
    this.theta2 = state[2];
    this.omega2 = state[3];
    this.time += dt;

    // Record trail for second bob
    this.computeLayout();
    const x1 = this.pivotX + Math.sin(this.theta1) * this.L1 * this.scale;
    const y1 = this.pivotY + Math.cos(this.theta1) * this.L1 * this.scale;
    const x2 = x1 + Math.sin(this.theta2) * this.L2 * this.scale;
    const y2 = y1 + Math.cos(this.theta2) * this.L2 * this.scale;

    this.trail.push({ x: x2, y: y2 });
    if (this.trail.length > this.maxTrail) this.trail.shift();

    // Phase space
    this.phaseHistory.push({
      th1: this.theta1, om1: this.omega1,
      th2: this.theta2, om2: this.omega2,
    });
    if (this.phaseHistory.length > this.maxPhase) this.phaseHistory.shift();
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);
    this.computeLayout();

    const { pivotX, pivotY, scale, L1, L2, theta1, theta2, m1, m2 } = this;

    const x1 = pivotX + Math.sin(theta1) * L1 * scale;
    const y1 = pivotY + Math.cos(theta1) * L1 * scale;
    const x2 = x1 + Math.sin(theta2) * L2 * scale;
    const y2 = y1 + Math.cos(theta2) * L2 * scale;

    // Trail
    if (this.showTrail && this.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = (i / this.trail.length) * 0.8;
        const hue = (i / this.trail.length) * 270; // Purple to red gradient
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
        ctx.lineWidth = 1 + alpha * 1.5;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Pivot
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(pivotX - 20, pivotY - 4, 40, 4);
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.restore();

    // Rods
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();

    // Bob 1
    const r1 = Math.max(8, Math.min(18, m1 * 6));
    ctx.save();
    const g1 = ctx.createRadialGradient(x1 - r1 * 0.3, y1 - r1 * 0.3, 0, x1, y1, r1);
    g1.addColorStop(0, '#f97316');
    g1.addColorStop(1, '#c2410c');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(x1, y1, r1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Bob 2
    const r2 = Math.max(8, Math.min(18, m2 * 6));
    ctx.save();
    const g2 = ctx.createRadialGradient(x2 - r2 * 0.3, y2 - r2 * 0.3, 0, x2, y2, r2);
    g2.addColorStop(0, '#60a5fa');
    g2.addColorStop(1, '#2563eb');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x2, y2, r2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Phase space
    if (this.showPhaseSpace) {
      this.renderPhaseSpace();
    }

    // Info
    const totalE = this.computeEnergy();
    drawText(ctx, `\u03b8\u2081 = ${(theta1 * 180 / Math.PI).toFixed(1)}\u00b0   \u03b8\u2082 = ${(theta2 * 180 / Math.PI).toFixed(1)}\u00b0`, 16, height - 58, '#e2e8f0', '13px system-ui');
    drawText(ctx, `E = ${totalE.toFixed(3)} J   t = ${this.time.toFixed(2)} s`, 16, height - 36, '#94a3b8', '13px system-ui');
    drawText(ctx, 'Chaotic system: sensitive to initial conditions', 16, height - 14, '#64748b', '12px system-ui');
  }

  private computeEnergy(): number {
    const { L1, L2, m1, m2, theta1, omega1, theta2, omega2, gravity: g } = this;
    const KE = 0.5 * m1 * (L1 * omega1) ** 2
      + 0.5 * m2 * ((L1 * omega1) ** 2 + (L2 * omega2) ** 2
        + 2 * L1 * L2 * omega1 * omega2 * Math.cos(theta1 - theta2));
    const PE = -(m1 + m2) * g * L1 * Math.cos(theta1)
      - m2 * g * L2 * Math.cos(theta2);
    return KE + PE;
  }

  private renderPhaseSpace(): void {
    const { ctx, width, height, phaseHistory } = this;
    if (phaseHistory.length < 2) return;

    const gx = width * 0.62;
    const gy = height * 0.08;
    const gw = width * 0.34;
    const gh = height * 0.38;

    // Background
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx - 4, gy - 4, gw + 8, gh + 8, 6);
    ctx.fill();
    ctx.stroke();

    // Axes
    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.beginPath();
    ctx.moveTo(gx + gw / 2, gy); ctx.lineTo(gx + gw / 2, gy + gh);
    ctx.moveTo(gx, gy + gh / 2); ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.stroke();

    // Plot theta1 vs omega1
    const scaleT = gw / (2 * Math.PI);
    const maxOm = 15;
    const scaleO = gh / (2 * maxOm);

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < phaseHistory.length; i++) {
      const px = gx + gw / 2 + phaseHistory[i].th1 * scaleT;
      const py = gy + gh / 2 - phaseHistory[i].om1 * scaleO;
      const cpx = Math.max(gx, Math.min(gx + gw, px));
      const cpy = Math.max(gy, Math.min(gy + gh, py));
      if (i === 0) ctx.moveTo(cpx, cpy);
      else ctx.lineTo(cpx, cpy);
    }
    ctx.stroke();

    // Plot theta2 vs omega2
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < phaseHistory.length; i++) {
      const px = gx + gw / 2 + phaseHistory[i].th2 * scaleT;
      const py = gy + gh / 2 - phaseHistory[i].om2 * scaleO;
      const cpx = Math.max(gx, Math.min(gx + gw, px));
      const cpy = Math.max(gy, Math.min(gy + gh, py));
      if (i === 0) ctx.moveTo(cpx, cpy);
      else ctx.lineTo(cpx, cpy);
    }
    ctx.stroke();
    ctx.restore();

    drawText(ctx, 'Phase Space (\u03b8 vs \u03c9)', gx + gw / 2, gy - 10, '#94a3b8', '11px system-ui', 'center');
    drawText(ctx, '\u03b81', gx + gw + 10, gy + gh * 0.3, '#f97316', '11px system-ui');
    drawText(ctx, '\u03b82', gx + gw + 10, gy + gh * 0.5, '#3b82f6', '11px system-ui');
  }

  reset(): void {
    this.setup();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'L1', label: 'Length 1', min: 0.5, max: 3, step: 0.1, defaultValue: 1.5, unit: 'm' },
      { type: 'slider', key: 'L2', label: 'Length 2', min: 0.5, max: 3, step: 0.1, defaultValue: 1.5, unit: 'm' },
      { type: 'slider', key: 'm1', label: 'Mass 1', min: 0.1, max: 5, step: 0.1, defaultValue: 1, unit: 'kg' },
      { type: 'slider', key: 'm2', label: 'Mass 2', min: 0.1, max: 5, step: 0.1, defaultValue: 1, unit: 'kg' },
      { type: 'toggle', key: 'showTrail', label: 'Trail', defaultValue: true },
      { type: 'toggle', key: 'showPhaseSpace', label: 'Phase Space', defaultValue: false },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      L1: this.L1,
      L2: this.L2,
      m1: this.m1,
      m2: this.m2,
      showTrail: this.showTrail,
      showPhaseSpace: this.showPhaseSpace,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'L1': this.L1 = value as number; break;
      case 'L2': this.L2 = value as number; break;
      case 'm1': this.m1 = value as number; break;
      case 'm2': this.m2 = value as number; break;
      case 'showTrail': this.showTrail = value as boolean; break;
      case 'showPhaseSpace': this.showPhaseSpace = value as boolean; break;
    }
  }
}

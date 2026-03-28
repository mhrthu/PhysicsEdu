import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { rk4Step } from '@/engine/math/numerical.ts';
import { clearCanvas, drawGrid, drawArrow, drawText, drawDashedLine } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

type SystemType = 'bead-parabola' | 'atwood' | 'rolling-disk';

export default class LagrangianMechanicsSim extends SimulationEngine {
  private systemType: SystemType = 'bead-parabola';

  // Shared params
  private param1 = 1.0; // context-dependent
  private param2 = 1.0;
  private gravity = 9.81;
  private showGenCoords = true;

  // Generalized coordinate state: [q, qdot]
  private q = 0;
  private qdot = 0;

  // History for graph
  private history: { t: number; q: number; T: number; V: number }[] = [];
  private maxHistory = 400;

  setup(): void {
    this.time = 0;
    this.history = [];
    this.initSystem();
  }

  private initSystem(): void {
    switch (this.systemType) {
      case 'bead-parabola':
        // Bead on y = a*x^2; q = x
        this.q = 1.5;
        this.qdot = 0;
        break;
      case 'atwood':
        // Atwood machine; q = displacement of m1 from center
        this.q = 0.5;
        this.qdot = 0;
        break;
      case 'rolling-disk':
        // Disk rolling on incline; q = distance along incline
        this.q = 0;
        this.qdot = 0;
        break;
    }
  }

  update(dt: number): void {
    const derivatives = this.getDerivatives();
    const state = rk4Step([this.q, this.qdot], this.time, dt, derivatives);
    this.q = state[0];
    this.qdot = state[1];
    this.time += dt;

    const { T, V } = this.computeEnergies();
    this.history.push({ t: this.time, q: this.q, T, V });
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  private getDerivatives(): (state: number[], t: number) => number[] {
    const g = this.gravity;

    switch (this.systemType) {
      case 'bead-parabola': {
        // y = a*x^2, q = x
        // L = T - V = 0.5*m*(1 + 4a^2*x^2)*xdot^2 - m*g*a*x^2
        // EOM: (1 + 4a^2*x^2)*xddot + 4a^2*x*xdot^2 + 2*g*a*x = 0
        const a = this.param1; // curvature
        return (state: number[], _t: number): number[] => {
          const [x, xdot] = state;
          const denom = 1 + 4 * a * a * x * x;
          const xddot = (-4 * a * a * x * xdot * xdot - 2 * g * a * x) / denom;
          return [xdot, xddot];
        };
      }
      case 'atwood': {
        // m1 and m2 on a string over pulley; q = displacement of m1 downward
        // L = 0.5*(m1+m2)*qdot^2 + (m1-m2)*g*q
        // EOM: (m1+m2)*qddot = (m1-m2)*g
        const m1 = this.param1;
        const m2 = this.param2;
        return (state: number[], _t: number): number[] => {
          const [_q, qdot] = state;
          const qddot = (m1 - m2) * g / (m1 + m2);
          return [qdot, qddot];
        };
      }
      case 'rolling-disk': {
        // Disk rolling without slipping on incline angle alpha
        // q = distance along incline
        // L = 0.5*m*qdot^2 + 0.5*I*(qdot/R)^2 - m*g*q*sin(alpha)
        //   = 0.5*(m + I/R^2)*qdot^2 - m*g*sin(alpha)*q
        // For solid disk I = 0.5*m*R^2 => m + I/R^2 = 1.5*m
        // EOM: 1.5*m*qddot = m*g*sin(alpha)
        const alpha = this.param1 * Math.PI / 180; // angle in degrees
        return (state: number[], _t: number): number[] => {
          const [_q, qdot] = state;
          const qddot = g * Math.sin(alpha) / 1.5;
          return [qdot, qddot];
        };
      }
    }
  }

  private computeEnergies(): { T: number; V: number } {
    const g = this.gravity;

    switch (this.systemType) {
      case 'bead-parabola': {
        const a = this.param1;
        const x = this.q;
        const xdot = this.qdot;
        const m = 1;
        const T = 0.5 * m * (1 + 4 * a * a * x * x) * xdot * xdot;
        const V = m * g * a * x * x;
        return { T, V };
      }
      case 'atwood': {
        const m1 = this.param1;
        const m2 = this.param2;
        const T = 0.5 * (m1 + m2) * this.qdot * this.qdot;
        const V = -(m1 - m2) * g * this.q;
        return { T, V };
      }
      case 'rolling-disk': {
        const alpha = this.param1 * Math.PI / 180;
        const m = this.param2;
        const T = 0.5 * 1.5 * m * this.qdot * this.qdot;
        const V = -m * g * Math.sin(alpha) * this.q;
        return { T, V };
      }
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);

    switch (this.systemType) {
      case 'bead-parabola': this.renderBeadParabola(); break;
      case 'atwood': this.renderAtwood(); break;
      case 'rolling-disk': this.renderRollingDisk(); break;
    }

    // Lagrangian info
    this.renderLagrangianInfo();

    // Energy graph
    this.renderEnergyGraph();
  }

  private renderBeadParabola(): void {
    const { ctx, width, height } = this;
    const a = this.param1;
    const cx = width * 0.35;
    const cy = height * 0.5;
    const scaleX = 50;
    const scaleY = 50;

    // Draw parabola
    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = -3; px <= 3; px += 0.05) {
      const sx = cx + px * scaleX;
      const sy = cy - a * px * px * scaleY;
      if (px === -3) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();

    // Draw bead
    const beadX = cx + this.q * scaleX;
    const beadY = cy - a * this.q * this.q * scaleY;
    const beadR = 10;

    ctx.save();
    const grad = ctx.createRadialGradient(beadX - 2, beadY - 2, 0, beadX, beadY, beadR);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(beadX, beadY, beadR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Normal and gravity arrows
    drawArrow(ctx, beadX, beadY, beadX, beadY + 30, '#ef4444', 2, 6);
    drawText(ctx, 'g', beadX + 8, beadY + 35, '#ef4444', '11px system-ui');

    // Coordinate
    if (this.showGenCoords) {
      drawDashedLine(ctx, cx, cy - 5, beadX, cy - 5, '#fbbf24', 1);
      drawText(ctx, `q = x = ${this.q.toFixed(2)}`, cx, cy + 20, '#fbbf24', '12px system-ui', 'center');
    }

    drawText(ctx, `y = ${a.toFixed(1)}x\u00b2`, cx, cy - a * 9 * scaleY - 15, '#64748b', '12px system-ui', 'center');
  }

  private renderAtwood(): void {
    const { ctx, width, height } = this;
    const m1 = this.param1;
    const m2 = this.param2;
    const cx = width * 0.35;
    const pulleyY = height * 0.15;
    const pulleyR = 20;
    const ropeLen = height * 0.35;

    // Pulley
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, pulleyY, pulleyR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    // Axle
    ctx.beginPath();
    ctx.arc(cx, pulleyY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.restore();

    // Support
    ctx.save();
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 40, pulleyY - pulleyR - 10, 80, 10);
    ctx.restore();

    const leftX = cx - pulleyR;
    const rightX = cx + pulleyR;
    const displacement = this.q * 50; // Scale

    // Ropes
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    // Left rope
    ctx.beginPath();
    ctx.moveTo(leftX, pulleyY);
    ctx.lineTo(leftX, pulleyY + ropeLen + displacement);
    ctx.stroke();
    // Right rope
    ctx.beginPath();
    ctx.moveTo(rightX, pulleyY);
    ctx.lineTo(rightX, pulleyY + ropeLen - displacement);
    ctx.stroke();
    ctx.restore();

    // Mass 1 (left)
    const m1Size = Math.max(24, Math.min(40, m1 * 10));
    const m1Y = pulleyY + ropeLen + displacement;
    ctx.save();
    const g1 = ctx.createLinearGradient(leftX - m1Size / 2, m1Y, leftX + m1Size / 2, m1Y + m1Size);
    g1.addColorStop(0, '#f97316');
    g1.addColorStop(1, '#c2410c');
    ctx.fillStyle = g1;
    ctx.fillRect(leftX - m1Size / 2, m1Y, m1Size, m1Size);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX - m1Size / 2, m1Y, m1Size, m1Size);
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`m\u2081=${m1.toFixed(1)}`, leftX, m1Y + m1Size / 2);
    ctx.restore();

    // Mass 2 (right)
    const m2Size = Math.max(24, Math.min(40, m2 * 10));
    const m2Y = pulleyY + ropeLen - displacement;
    ctx.save();
    const g2 = ctx.createLinearGradient(rightX - m2Size / 2, m2Y, rightX + m2Size / 2, m2Y + m2Size);
    g2.addColorStop(0, '#60a5fa');
    g2.addColorStop(1, '#2563eb');
    ctx.fillStyle = g2;
    ctx.fillRect(rightX - m2Size / 2, m2Y, m2Size, m2Size);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.strokeRect(rightX - m2Size / 2, m2Y, m2Size, m2Size);
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`m\u2082=${m2.toFixed(1)}`, rightX, m2Y + m2Size / 2);
    ctx.restore();

    if (this.showGenCoords) {
      drawText(ctx, `q = ${this.q.toFixed(3)} m`, cx, height * 0.75, '#fbbf24', '13px system-ui', 'center');
      drawText(ctx, `q\u0307 = ${this.qdot.toFixed(3)} m/s`, cx, height * 0.78, '#94a3b8', '12px system-ui', 'center');
    }
  }

  private renderRollingDisk(): void {
    const { ctx, width, height } = this;
    const alpha = this.param1 * Math.PI / 180;
    const mass = this.param2;

    const baseX = width * 0.1;
    const baseY = height * 0.7;
    const rampLen = Math.min(width * 0.5, height * 0.6);
    const topX = baseX + rampLen * Math.cos(alpha);
    const topY = baseY - rampLen * Math.sin(alpha);

    // Draw ramp
    ctx.save();
    ctx.fillStyle = '#1e293b';
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

    // Angle label
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(baseX, baseY, 40, -alpha, 0, false);
    ctx.stroke();
    ctx.restore();
    drawText(ctx, `${this.param1.toFixed(0)}\u00b0`, baseX + 45, baseY - 12, '#fbbf24', '12px system-ui');

    // Disk position along ramp
    const diskR = Math.max(15, Math.min(25, mass * 5));
    const dist = Math.max(diskR / Math.cos(alpha), this.q * 30);
    const diskCX = baseX + dist * Math.cos(alpha);
    const diskCY = baseY - dist * Math.sin(alpha) - diskR;

    // Draw disk
    ctx.save();
    const grad = ctx.createRadialGradient(diskCX - 3, diskCY - 3, 0, diskCX, diskCY, diskR);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(diskCX, diskCY, diskR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rolling mark (rotation indicator)
    const rotAngle = this.q * 30 / diskR;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(diskCX, diskCY);
    ctx.lineTo(diskCX + Math.cos(rotAngle) * diskR * 0.8, diskCY + Math.sin(rotAngle) * diskR * 0.8);
    ctx.stroke();
    ctx.restore();

    if (this.showGenCoords) {
      drawText(ctx, `q = ${this.q.toFixed(3)} m (along incline)`, baseX, baseY + 30, '#fbbf24', '12px system-ui');
      drawText(ctx, `q\u0307 = ${this.qdot.toFixed(3)} m/s`, baseX, baseY + 48, '#94a3b8', '12px system-ui');
    }
  }

  private renderLagrangianInfo(): void {
    const { ctx, width, height } = this;
    const { T, V } = this.computeEnergies();
    const L = T - V;

    const infoX = width * 0.02;
    const infoY = height - 120;

    // Background panel
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(infoX - 4, infoY - 4, 280, 90, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawText(ctx, `T = ${T.toFixed(4)} J`, infoX + 8, infoY + 12, '#3b82f6', '13px system-ui');
    drawText(ctx, `V = ${V.toFixed(4)} J`, infoX + 8, infoY + 30, '#ef4444', '13px system-ui');
    drawText(ctx, `L = T - V = ${L.toFixed(4)} J`, infoX + 8, infoY + 50, '#22c55e', 'bold 13px system-ui');

    // EOM text
    let eom = '';
    switch (this.systemType) {
      case 'bead-parabola':
        eom = `(1+4a\u00b2x\u00b2)x\u0308 + 4a\u00b2x\u1e8b\u00b2 + 2gax = 0`;
        break;
      case 'atwood':
        eom = `(m\u2081+m\u2082)q\u0308 = (m\u2081-m\u2082)g`;
        break;
      case 'rolling-disk':
        eom = `1.5m\u00b7q\u0308 = mg sin\u03b1`;
        break;
    }
    drawText(ctx, `EOM: ${eom}`, infoX + 8, infoY + 72, '#94a3b8', '11px system-ui');
  }

  private renderEnergyGraph(): void {
    const { ctx, width, height, history } = this;
    if (history.length < 2) return;

    const gx = width * 0.6;
    const gy = height * 0.55;
    const gw = width * 0.36;
    const gh = height * 0.35;

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.7)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx - 4, gy - 4, gw + 8, gh + 8, 6);
    ctx.fill();
    ctx.stroke();

    let maxE = 0.01;
    for (const h of history) {
      maxE = Math.max(maxE, Math.abs(h.T), Math.abs(h.V), Math.abs(h.T - h.V));
    }

    // T
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = gx + (i / this.maxHistory) * gw;
      const py = gy + gh / 2 - (history[i].T / maxE) * (gh / 2) * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // V
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = gx + (i / this.maxHistory) * gw;
      const py = gy + gh / 2 - (history[i].V / maxE) * (gh / 2) * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // L = T - V
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = gx + (i / this.maxHistory) * gw;
      const py = gy + gh / 2 - ((history[i].T - history[i].V) / maxE) * (gh / 2) * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    drawText(ctx, 'Energy vs Time', gx + gw / 2, gy - 10, '#94a3b8', '11px system-ui', 'center');
    drawText(ctx, 'T', gx + gw + 8, gy + gh * 0.2, '#3b82f6', '11px system-ui');
    drawText(ctx, 'V', gx + gw + 8, gy + gh * 0.4, '#ef4444', '11px system-ui');
    drawText(ctx, 'L', gx + gw + 8, gy + gh * 0.6, '#22c55e', '11px system-ui');
  }

  reset(): void {
    this.time = 0;
    this.history = [];
    this.initSystem();
  }

  getControlDescriptors(): ControlDescriptor[] {
    const descriptors: ControlDescriptor[] = [
      {
        type: 'dropdown', key: 'systemType', label: 'System',
        options: [
          { value: 'bead-parabola', label: 'Bead on Parabola' },
          { value: 'atwood', label: 'Atwood Machine' },
          { value: 'rolling-disk', label: 'Rolling Disk on Incline' },
        ],
        defaultValue: 'bead-parabola',
      },
    ];

    switch (this.systemType) {
      case 'bead-parabola':
        descriptors.push(
          { type: 'slider', key: 'param1', label: 'Curvature (a)', min: 0.1, max: 3, step: 0.1, defaultValue: 1 },
        );
        break;
      case 'atwood':
        descriptors.push(
          { type: 'slider', key: 'param1', label: 'Mass 1', min: 0.5, max: 10, step: 0.1, defaultValue: 1, unit: 'kg' },
          { type: 'slider', key: 'param2', label: 'Mass 2', min: 0.5, max: 10, step: 0.1, defaultValue: 1, unit: 'kg' },
        );
        break;
      case 'rolling-disk':
        descriptors.push(
          { type: 'slider', key: 'param1', label: 'Incline Angle', min: 5, max: 60, step: 1, defaultValue: 30, unit: '\u00b0' },
          { type: 'slider', key: 'param2', label: 'Disk Mass', min: 0.5, max: 10, step: 0.1, defaultValue: 1, unit: 'kg' },
        );
        break;
    }

    descriptors.push(
      { type: 'slider', key: 'gravity', label: 'Gravity', min: 1, max: 25, step: 0.1, defaultValue: 9.81, unit: 'm/s\u00b2' },
      { type: 'toggle', key: 'showGenCoords', label: 'Generalized Coordinates', defaultValue: true },
    );

    return descriptors;
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      systemType: this.systemType,
      param1: this.param1,
      param2: this.param2,
      gravity: this.gravity,
      showGenCoords: this.showGenCoords,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'systemType':
        this.systemType = value as SystemType;
        this.reset();
        break;
      case 'param1': this.param1 = value as number; break;
      case 'param2': this.param2 = value as number; break;
      case 'gravity': this.gravity = value as number; break;
      case 'showGenCoords': this.showGenCoords = value as boolean; break;
    }
  }
}

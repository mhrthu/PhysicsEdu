import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { rk4Step } from '@/engine/math/numerical.ts';
import { clearCanvas, drawGrid, drawText, drawDashedLine } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

export default class SpringMassSim extends SimulationEngine {
  private k = 20;
  private mass = 1;
  private damping = 0.0;
  private showEnergyGraph = true;

  // State: [x, v] (displacement from equilibrium, velocity)
  private x = 0;
  private v = 0;
  private initialX = 100; // pixels

  // Graph data
  private history: { t: number; x: number; ke: number; pe: number }[] = [];
  private maxHistory = 400;

  // Interaction
  private dragging = false;

  // Layout
  private anchorX = 0;
  private anchorY = 0;
  private eqX = 0;
  private pixelsPerMeter = 100;

  setup(): void {
    this.time = 0;
    this.x = this.initialX / this.pixelsPerMeter;
    this.v = 0;
    this.history = [];
    this.computeLayout();
  }

  private computeLayout(): void {
    this.anchorX = this.width * 0.08;
    this.anchorY = this.height * 0.35;
    this.eqX = this.width * 0.45;
    this.pixelsPerMeter = Math.min(this.width * 0.3, 150);
  }

  update(dt: number): void {
    if (this.dragging) return;

    const { k, mass, damping } = this;

    const derivatives = (state: number[], _t: number): number[] => {
      const [x, v] = state;
      return [v, -(k / mass) * x - (damping / mass) * v];
    };

    const state = rk4Step([this.x, this.v], this.time, dt, derivatives);
    this.x = state[0];
    this.v = state[1];
    this.time += dt;

    // Record history
    const ke = 0.5 * mass * this.v * this.v;
    const pe = 0.5 * k * this.x * this.x;
    this.history.push({ t: this.time, x: this.x, ke, pe });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);
    this.computeLayout();

    const { anchorX, anchorY, eqX, pixelsPerMeter } = this;
    const massX = eqX + this.x * pixelsPerMeter;
    const massSize = Math.max(24, Math.min(44, this.mass * 8));

    // Draw wall
    ctx.save();
    ctx.fillStyle = '#334155';
    ctx.fillRect(anchorX - 12, anchorY - 60, 12, 120);
    // Hatching
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    for (let i = -60; i < 120; i += 10) {
      ctx.beginPath();
      ctx.moveTo(anchorX - 12, anchorY + i - 60);
      ctx.lineTo(anchorX, anchorY + i - 50);
      ctx.stroke();
    }
    ctx.restore();

    // Draw spring (zigzag)
    this.drawSpring(anchorX, anchorY, massX - massSize / 2, anchorY, 16);

    // Draw equilibrium line
    drawDashedLine(ctx, eqX, anchorY - 50, eqX, anchorY + 50, 'rgba(148,163,184,0.3)', 1);
    drawText(ctx, 'x=0', eqX, anchorY - 60, '#64748b', '11px system-ui', 'center');

    // Draw mass block
    ctx.save();
    const grad = ctx.createLinearGradient(massX - massSize / 2, anchorY - massSize / 2, massX + massSize / 2, anchorY + massSize / 2);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(massX - massSize / 2, anchorY - massSize / 2, massSize, massSize, 4);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.mass}kg`, massX, anchorY);
    ctx.restore();

    // Displacement arrow
    if (Math.abs(this.x) > 0.01) {
      const color = this.x > 0 ? '#ef4444' : '#3b82f6';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(eqX, anchorY + massSize / 2 + 15);
      ctx.lineTo(massX, anchorY + massSize / 2 + 15);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      drawText(ctx, `x = ${this.x.toFixed(2)} m`, (eqX + massX) / 2, anchorY + massSize / 2 + 30, color, '12px system-ui', 'center');
    }

    // Displacement vs time graph
    this.renderGraph();

    // Energy graph
    if (this.showEnergyGraph) {
      this.renderEnergyGraph();
    }

    // Info
    const omega = Math.sqrt(this.k / this.mass);
    const period = 2 * Math.PI / omega;
    const dampRatio = this.damping / (2 * Math.sqrt(this.k * this.mass));
    drawText(ctx, `\u03c9 = \u221a(k/m) = ${omega.toFixed(2)} rad/s   T = ${period.toFixed(3)} s`, 16, height - 36, '#e2e8f0', '13px system-ui');
    drawText(ctx, `\u03b6 = ${dampRatio.toFixed(3)}   t = ${this.time.toFixed(2)} s`, 16, height - 14, '#94a3b8', '12px system-ui');
  }

  private drawSpring(x1: number, y1: number, x2: number, y2: number, coils: number): void {
    const { ctx } = this;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const amp = 12;

    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);

    const segLen = len / (coils * 2 + 2);
    // Lead-in
    ctx.lineTo(x1 + segLen * dx / len, y1 + segLen * dy / len);

    for (let i = 0; i < coils * 2; i++) {
      const t = (i + 1) / (coils * 2 + 2) + 1 / (coils * 2 + 2);
      const px = x1 + t * dx;
      const py = y1 + t * dy + (i % 2 === 0 ? -amp : amp);
      ctx.lineTo(px, py);
    }

    // Lead-out
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  private renderGraph(): void {
    const { ctx, width, height, history } = this;
    if (history.length < 2) return;

    const gx = 16;
    const gy = height * 0.55;
    const gw = width * 0.45;
    const gh = height * 0.3;

    // Background
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.7)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx - 4, gy - 4, gw + 8, gh + 8, 6);
    ctx.fill();
    ctx.stroke();

    // Zero line
    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh / 2);
    ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.stroke();

    // Find scale
    let maxX = 0.01;
    for (const h of history) {
      maxX = Math.max(maxX, Math.abs(h.x));
    }

    // Plot displacement
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = gx + (i / this.maxHistory) * gw;
      const py = gy + gh / 2 - (history[i].x / maxX) * (gh / 2) * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    drawText(ctx, 'x(t)', gx + gw + 8, gy + gh / 2, '#f97316', '12px system-ui');
    drawText(ctx, 'Displacement vs Time', gx + gw / 2, gy - 10, '#94a3b8', '11px system-ui', 'center');
  }

  private renderEnergyGraph(): void {
    const { ctx, width, height, history } = this;
    if (history.length < 2) return;

    const gx = width * 0.54;
    const gy = height * 0.55;
    const gw = width * 0.42;
    const gh = height * 0.3;

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
      maxE = Math.max(maxE, h.ke + h.pe);
    }

    // KE
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = gx + (i / this.maxHistory) * gw;
      const py = gy + gh - (history[i].ke / maxE) * gh * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // PE
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = gx + (i / this.maxHistory) * gw;
      const py = gy + gh - (history[i].pe / maxE) * gh * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Total
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const px = gx + (i / this.maxHistory) * gw;
      const py = gy + gh - ((history[i].ke + history[i].pe) / maxE) * gh * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    drawText(ctx, 'Energy vs Time', gx + gw / 2, gy - 10, '#94a3b8', '11px system-ui', 'center');
    drawText(ctx, 'KE', gx + gw + 8, gy + gh * 0.3, '#3b82f6', '11px system-ui');
    drawText(ctx, 'PE', gx + gw + 8, gy + gh * 0.5, '#ef4444', '11px system-ui');
    drawText(ctx, 'E', gx + gw + 8, gy + gh * 0.7, '#22c55e', '11px system-ui');
  }

  reset(): void {
    this.x = this.initialX / this.pixelsPerMeter;
    this.v = 0;
    this.time = 0;
    this.history = [];
    this.dragging = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'k', label: 'Spring Constant k', min: 1, max: 100, step: 1, defaultValue: 20, unit: 'N/m' },
      { type: 'slider', key: 'mass', label: 'Mass', min: 0.1, max: 10, step: 0.1, defaultValue: 1, unit: 'kg' },
      { type: 'slider', key: 'damping', label: 'Damping', min: 0, max: 2, step: 0.01, defaultValue: 0 },
      { type: 'toggle', key: 'showEnergyGraph', label: 'Energy Graph', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      k: this.k,
      mass: this.mass,
      damping: this.damping,
      showEnergyGraph: this.showEnergyGraph,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'k': this.k = value as number; break;
      case 'mass': this.mass = value as number; break;
      case 'damping': this.damping = value as number; break;
      case 'showEnergyGraph': this.showEnergyGraph = value as boolean; break;
    }
  }

  onPointerDown(x: number, _y: number): void {
    this.computeLayout();
    const massX = this.eqX + this.x * this.pixelsPerMeter;
    if (Math.abs(x - massX) < 40) {
      this.dragging = true;
      this.v = 0;
    }
  }

  onPointerMove(x: number, _y: number): void {
    if (!this.dragging) return;
    this.computeLayout();
    this.x = (x - this.eqX) / this.pixelsPerMeter;
    this.x = Math.max(-2, Math.min(2, this.x));
    this.initialX = this.x * this.pixelsPerMeter;
  }

  onPointerUp(_x: number, _y: number): void {
    this.dragging = false;
  }
}

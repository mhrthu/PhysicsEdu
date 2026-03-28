import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText } from '@/engine/render/drawUtils.ts';

export default class SuperconductivitySim extends SimulationEngine {
  private temperature = 100;
  private tc = 92;
  private fieldStrength = 1;

  private animTime = 0;

  // Layout regions
  private sceneLeft = 0;
  private sceneRight = 0;
  private sceneTop = 0;
  private sceneBottom = 0;
  private graphLeft = 0;
  private graphRight = 0;
  private graphTop = 0;
  private graphBottom = 0;

  setup(): void {
    this.computeLayout();
  }

  private computeLayout(): void {
    const margin = 40;
    this.sceneLeft = margin;
    this.sceneRight = this.width * 0.6;
    this.sceneTop = margin;
    this.sceneBottom = this.height - margin;

    this.graphLeft = this.width * 0.65;
    this.graphRight = this.width - 30;
    this.graphTop = this.height * 0.15;
    this.graphBottom = this.height * 0.55;
  }

  private get isSuperconducting(): boolean {
    return this.temperature < this.tc;
  }

  private get resistance(): number {
    if (this.isSuperconducting) return 0;
    // Linear above Tc for simplicity
    const Rn = 0.5; // normal state resistance (arbitrary units)
    return Rn * (1 + (this.temperature - this.tc) * 0.005);
  }

  private get levitationHeight(): number {
    if (!this.isSuperconducting) return 0;
    // Stronger field and lower temperature = more levitation
    const tFrac = 1 - this.temperature / this.tc;
    return tFrac * this.fieldStrength * 80;
  }

  update(dt: number): void {
    this.time += dt;
    this.animTime += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    this.renderScene();
    this.renderResistanceGraph();
    this.renderInfoOverlay();
  }

  private renderScene(): void {
    const { ctx } = this;
    const sl = this.sceneLeft;
    const sr = this.sceneRight;
    const sw = sr - sl;
    const centerX = (sl + sr) / 2;
    const scBottom = this.sceneBottom - 20;

    // Superconductor disk
    const scDiskY = scBottom - 30;
    const scDiskW = sw * 0.5;
    const scDiskH = 30;
    const scDiskLeft = centerX - scDiskW / 2;

    // Color based on state
    const scColor = this.isSuperconducting ? '#38bdf8' : '#64748b';
    const scGlow = this.isSuperconducting ? 'rgba(56, 189, 248, 0.3)' : 'transparent';

    // Glow effect when superconducting
    if (this.isSuperconducting) {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 20;
    }

    ctx.fillStyle = scColor;
    ctx.strokeStyle = this.isSuperconducting ? '#7dd3fc' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(scDiskLeft, scDiskY, scDiskW, scDiskH, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    drawText(ctx, 'YBCO Superconductor', centerX, scDiskY + scDiskH / 2, '#0f172a', '10px system-ui', 'center');

    // Magnet
    const levH = this.levitationHeight;
    const magnetY = scDiskY - 40 - levH;
    const magnetW = sw * 0.18;
    const magnetH = 28;
    const magnetLeft = centerX - magnetW / 2;

    // Magnet body (N/S poles)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(magnetLeft, magnetY, magnetW / 2, magnetH);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(magnetLeft + magnetW / 2, magnetY, magnetW / 2, magnetH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(magnetLeft, magnetY, magnetW, magnetH);
    drawText(ctx, 'N', magnetLeft + magnetW * 0.25, magnetY + magnetH / 2, '#fff', 'bold 10px system-ui', 'center');
    drawText(ctx, 'S', magnetLeft + magnetW * 0.75, magnetY + magnetH / 2, '#fff', 'bold 10px system-ui', 'center');

    // Magnetic field lines
    this.renderFieldLines(centerX, magnetY + magnetH, scDiskY, scDiskLeft, scDiskW);

    // State label
    const stateLabel = this.isSuperconducting ? 'SUPERCONDUCTING' : 'NORMAL STATE';
    const stateColor = this.isSuperconducting ? '#22c55e' : '#f59e0b';
    drawText(ctx, stateLabel, centerX, this.sceneTop + 20, stateColor, 'bold 14px system-ui', 'center');

    if (this.isSuperconducting && levH > 5) {
      drawText(ctx, 'Meissner Effect - Field Expelled', centerX, this.sceneTop + 40, '#94a3b8', '11px system-ui', 'center');
    }
  }

  private renderFieldLines(cx: number, magnetBottom: number, scTop: number, scLeft: number, scWidth: number): void {
    const { ctx } = this;
    const numLines = 7;
    const spread = this.fieldStrength * 40;

    for (let i = 0; i < numLines; i++) {
      const frac = (i / (numLines - 1)) - 0.5; // -0.5 to 0.5
      const startX = cx + frac * spread * 1.5;
      const startY = magnetBottom;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.3 + this.fieldStrength * 0.2})`;
      ctx.lineWidth = 1.5;

      if (this.isSuperconducting) {
        // Field lines bend around the superconductor
        const bendAmount = Math.abs(frac) < 0.15 ? 60 : 30;
        const sideSign = frac >= 0 ? 1 : -1;
        const endX = cx + sideSign * (scWidth / 2 + 20 + Math.abs(frac) * 80);

        ctx.moveTo(startX, startY);
        // Curve away from superconductor
        const midY = (startY + scTop) / 2;
        ctx.bezierCurveTo(
          startX, midY,
          endX, midY + 20,
          endX, scTop + 40
        );
        // Continue downward past the superconductor edges
        ctx.bezierCurveTo(
          endX, scTop + 80,
          endX - sideSign * 10, scTop + 100,
          endX - sideSign * 20, scTop + 120
        );
      } else {
        // Field lines go straight through
        ctx.moveTo(startX, startY);
        const endY = scTop + 80;
        const wave = Math.sin(this.animTime * 2 + i) * 3;
        ctx.bezierCurveTo(
          startX + wave, (startY + endY) * 0.4,
          startX - wave, (startY + endY) * 0.6,
          startX, endY
        );
      }
      ctx.stroke();

      // Arrowhead at midpoint of line
      const arrowY = (magnetBottom + scTop) / 2;
      const arrowX = this.isSuperconducting
        ? cx + (frac >= 0 ? 1 : -1) * (scWidth / 2 + 10 + Math.abs(frac) * 40)
        : startX;
      ctx.beginPath();
      ctx.fillStyle = `rgba(251, 146, 60, ${0.4 + this.fieldStrength * 0.2})`;
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 3, arrowY - 6);
      ctx.lineTo(arrowX + 3, arrowY - 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderResistanceGraph(): void {
    const { ctx } = this;
    const gl = this.graphLeft;
    const gr = this.graphRight;
    const gt = this.graphTop;
    const gb = this.graphBottom;
    const gw = gr - gl;
    const gh = gb - gt;

    // Background
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(gl - 15, gt - 25, gw + 35, gh + 50);

    drawText(ctx, 'Resistance vs Temperature', gl + gw / 2, gt - 10, '#e2e8f0', '11px system-ui', 'center');

    // Axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gl, gt);
    ctx.lineTo(gl, gb);
    ctx.lineTo(gr, gb);
    ctx.stroke();

    drawText(ctx, 'R', gl - 10, gt, '#94a3b8', '10px monospace', 'right');
    drawText(ctx, 'T (K)', gr, gb + 15, '#94a3b8', '10px monospace', 'right');
    drawText(ctx, '0', gl - 5, gb, '#64748b', '9px monospace', 'right');
    drawText(ctx, '150', gr, gb + 15, '#64748b', '9px monospace', 'center');

    // Draw R(T) curve
    const maxT = 150;
    const maxR = 1.0;

    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    for (let T = 0; T <= maxT; T += 1) {
      const x = gl + (T / maxT) * gw;
      let R: number;
      if (T < this.tc) {
        R = 0;
      } else {
        R = 0.5 * (1 + (T - this.tc) * 0.005);
      }
      const y = gb - (R / maxR) * gh * 0.9;
      if (T === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Tc marker
    const tcX = gl + (this.tc / maxT) * gw;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tcX, gt);
    ctx.lineTo(tcX, gb);
    ctx.stroke();
    ctx.setLineDash([]);
    drawText(ctx, `Tc=${this.tc}K`, tcX, gb + 15, '#f59e0b', '9px monospace', 'center');

    // Current temperature marker
    const curX = gl + (this.temperature / maxT) * gw;
    const curR = this.resistance;
    const curY = gb - (curR / maxR) * gh * 0.9;

    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private renderInfoOverlay(): void {
    const { ctx, width, height } = this;

    const infoX = this.graphRight;
    const infoY = this.graphBottom + 40;

    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(this.graphLeft - 15, infoY - 5, this.graphRight - this.graphLeft + 35, 110);

    drawText(ctx, `Temperature: ${this.temperature} K`, infoX, infoY + 10, '#e2e8f0', '11px monospace', 'right');
    drawText(ctx, `Critical Temp (Tc): ${this.tc} K`, infoX, infoY + 28, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Resistance: ${this.resistance.toFixed(3)} (a.u.)`, infoX, infoY + 46, '#94a3b8', '11px monospace', 'right');

    const stateStr = this.isSuperconducting ? 'Superconducting' : 'Normal';
    const stateCol = this.isSuperconducting ? '#22c55e' : '#f59e0b';
    drawText(ctx, `State: ${stateStr}`, infoX, infoY + 64, stateCol, '11px monospace', 'right');

    if (this.isSuperconducting) {
      drawText(ctx, `Levitation Height: ${this.levitationHeight.toFixed(1)} (a.u.)`, infoX, infoY + 82, '#94a3b8', '11px monospace', 'right');
    } else {
      drawText(ctx, `Levitation Height: 0`, infoX, infoY + 82, '#94a3b8', '11px monospace', 'right');
    }
  }

  reset(): void {
    this.time = 0;
    this.animTime = 0;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.computeLayout();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'temperature', label: 'Temperature', min: 0, max: 150, step: 1, defaultValue: 100, unit: 'K' },
      { type: 'slider', key: 'tc', label: 'Critical Temp (Tc)', min: 20, max: 120, step: 1, defaultValue: 92, unit: 'K' },
      { type: 'slider', key: 'fieldStrength', label: 'Magnetic Field', min: 0.5, max: 3, step: 0.1, defaultValue: 1, unit: 'T' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      temperature: this.temperature,
      tc: this.tc,
      fieldStrength: this.fieldStrength,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'temperature': this.temperature = value as number; break;
      case 'tc': this.tc = value as number; break;
      case 'fieldStrength': this.fieldStrength = value as number; break;
    }
  }
}

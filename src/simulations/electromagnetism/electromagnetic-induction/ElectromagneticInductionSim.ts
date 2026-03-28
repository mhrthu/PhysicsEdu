import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText, drawArrow } from '@/engine/render/drawUtils.ts';

export default class ElectromagneticInductionSim extends SimulationEngine {
  private coilTurns = 10;
  private magnetStrength = 1;
  private showFieldLines = true;

  private magnetX = 0;
  private magnetY = 0;
  private magnetWidth = 100;
  private magnetHeight = 40;
  private coilCenterX = 0;
  private coilCenterY = 0;
  private coilWidth = 60;
  private coilHeight = 140;

  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private flux = 0;
  private prevFlux = 0;
  private emf = 0;

  setup(): void {
    this.coilCenterX = this.width * 0.6;
    this.coilCenterY = this.height * 0.45;
    this.magnetX = this.width * 0.2;
    this.magnetY = this.height * 0.45 - this.magnetHeight / 2;
    this.prevFlux = this.computeFlux();
    this.flux = this.prevFlux;
    this.emf = 0;
  }

  private computeFlux(): number {
    const dx = this.coilCenterX - (this.magnetX + this.magnetWidth / 2);
    const dy = this.coilCenterY - (this.magnetY + this.magnetHeight / 2);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const B = this.magnetStrength * 5000 / (dist * dist);
    const coilArea = this.coilWidth * this.coilHeight;
    const cosTheta = Math.abs(dx) / dist;
    return B * coilArea * cosTheta * this.coilTurns * 0.0001;
  }

  update(dt: number): void {
    this.time += dt;
    this.prevFlux = this.flux;
    this.flux = this.computeFlux();
    const dFluxDt = (this.flux - this.prevFlux) / dt;
    this.emf = -dFluxDt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    // Title
    drawText(ctx, 'Electromagnetic Induction (Faraday\'s Law)', width / 2, 24, '#e2e8f0', 'bold 16px system-ui', 'center');

    // Draw magnetic field lines
    if (this.showFieldLines) {
      this.drawFieldLines();
    }

    // Draw coil (cross-section view: parallel vertical lines)
    this.drawCoil();

    // Draw bar magnet
    this.drawMagnet();

    // Draw galvanometer
    this.drawGalvanometer();

    // Draw info overlay
    this.drawInfo();
  }

  private drawFieldLines(): void {
    const { ctx } = this;
    const mx = this.magnetX + this.magnetWidth / 2;
    const my = this.magnetY + this.magnetHeight / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 1.5;

    for (let i = -3; i <= 3; i++) {
      const offsetY = i * 18;
      ctx.beginPath();
      // Field lines emanating from N pole (right side) curving around to S pole (left side)
      const startX = mx + this.magnetWidth / 2;
      const startY = my + offsetY * 0.5;
      ctx.moveTo(startX, startY);

      const spread = Math.abs(i) * 40 + 30;
      ctx.bezierCurveTo(
        startX + spread * 0.8, startY + offsetY * 2,
        mx - this.magnetWidth / 2 - spread * 0.8, startY + offsetY * 2,
        mx - this.magnetWidth / 2, startY
      );
      ctx.stroke();

      // Arrowhead at midpoint
      if (i !== 0) {
        const arrowX = mx + spread * 0.3;
        const arrowY = startY + offsetY * 1.5;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.beginPath();
        ctx.moveTo(arrowX + 5, arrowY);
        ctx.lineTo(arrowX - 3, arrowY - 4);
        ctx.lineTo(arrowX - 3, arrowY + 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawCoil(): void {
    const { ctx } = this;
    const cx = this.coilCenterX;
    const cy = this.coilCenterY;
    const hw = this.coilWidth / 2;
    const hh = this.coilHeight / 2;
    const numLines = Math.min(this.coilTurns, 20);
    const spacing = this.coilWidth / (numLines + 1);

    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;

    for (let i = 1; i <= numLines; i++) {
      const x = cx - hw + i * spacing;
      ctx.beginPath();
      ctx.moveTo(x, cy - hh);
      ctx.lineTo(x, cy + hh);
      ctx.stroke();
    }

    // Coil outline
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - hw - 4, cy - hh - 4, this.coilWidth + 8, this.coilHeight + 8);

    // Label
    drawText(ctx, `Coil (N=${this.coilTurns})`, cx, cy + hh + 22, '#94a3b8', '11px system-ui', 'center');

    // Current direction indicators
    const absEmf = Math.abs(this.emf);
    if (absEmf > 0.001) {
      const dir = this.emf > 0 ? 1 : -1;
      const arrowColor = '#dc2626';
      // Top wire
      drawArrow(ctx, cx - hw - 20, cy - hh - 4, cx - hw - 20 + dir * 30, cy - hh - 4, arrowColor, 2, 8);
      // Bottom wire
      drawArrow(ctx, cx + hw + 20, cy + hh + 4, cx + hw + 20 - dir * 30, cy + hh + 4, arrowColor, 2, 8);
      drawText(ctx, 'I', cx - hw - 20 + dir * 15, cy - hh - 18, arrowColor, 'bold 12px system-ui', 'center');
    }

    ctx.restore();
  }

  private drawMagnet(): void {
    const { ctx } = this;
    const mx = this.magnetX;
    const my = this.magnetY;
    const mw = this.magnetWidth;
    const mh = this.magnetHeight;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(mx + 3, my + 3, mw, mh);

    // South pole (left half - blue)
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(mx, my, mw / 2, mh);
    drawText(ctx, 'S', mx + mw / 4, my + mh / 2, '#ffffff', 'bold 16px system-ui', 'center');

    // North pole (right half - red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(mx + mw / 2, my, mw / 2, mh);
    drawText(ctx, 'N', mx + 3 * mw / 4, my + mh / 2, '#ffffff', 'bold 16px system-ui', 'center');

    // Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx, my, mw, mh);

    drawText(ctx, 'Drag magnet', mx + mw / 2, my + mh + 18, '#64748b', '10px system-ui', 'center');

    ctx.restore();
  }

  private drawGalvanometer(): void {
    const { ctx } = this;
    const gx = this.coilCenterX;
    const gy = this.height - 90;
    const radius = 40;

    ctx.save();

    // Circle
    ctx.beginPath();
    ctx.arc(gx, gy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Scale markings
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      const angle = Math.PI + (i / 5) * (Math.PI * 0.4);
      const inner = radius - 8;
      const outer = radius - 3;
      ctx.beginPath();
      ctx.moveTo(gx + inner * Math.cos(angle), gy + inner * Math.sin(angle));
      ctx.lineTo(gx + outer * Math.cos(angle), gy + outer * Math.sin(angle));
      ctx.stroke();
    }

    // Needle - deflection proportional to EMF
    const maxDeflection = Math.PI * 0.35;
    const clampedEmf = Math.max(-1, Math.min(1, this.emf * 5));
    const needleAngle = Math.PI + clampedEmf * maxDeflection;
    const needleLen = radius - 10;

    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + needleLen * Math.cos(needleAngle), gy + needleLen * Math.sin(needleAngle));
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(gx, gy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();

    // Label
    drawText(ctx, 'Galvanometer', gx, gy + radius + 16, '#94a3b8', '11px system-ui', 'center');
    drawText(ctx, '- 0 +', gx, gy - radius + 14, '#64748b', '10px system-ui', 'center');

    // Connect wires from coil to galvanometer
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    const coilBottom = this.coilCenterY + this.coilHeight / 2 + 4;
    ctx.beginPath();
    ctx.moveTo(this.coilCenterX - 20, coilBottom);
    ctx.lineTo(this.coilCenterX - 20, gy - radius);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.coilCenterX + 20, coilBottom);
    ctx.lineTo(this.coilCenterX + 20, gy - radius);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  private drawInfo(): void {
    const { ctx, width } = this;
    const infoX = width - 15;
    const infoY = 50;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const boxW = 220;
    const boxH = 85;
    ctx.fillRect(infoX - boxW, infoY - 5, boxW + 5, boxH);
    ctx.strokeRect(infoX - boxW, infoY - 5, boxW + 5, boxH);

    drawText(ctx, `EMF: ${this.emf.toFixed(4)} V`, infoX, infoY + 12, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Flux (\u03A6): ${this.flux.toFixed(4)} Wb`, infoX, infoY + 30, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Coil Turns: ${this.coilTurns}`, infoX, infoY + 48, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Magnet Strength: ${this.magnetStrength.toFixed(1)}`, infoX, infoY + 66, '#94a3b8', '11px monospace', 'right');
  }

  reset(): void {
    this.setup();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.coilCenterX = this.width * 0.6;
    this.coilCenterY = this.height * 0.45;
  }

  onPointerDown(x: number, y: number): void {
    if (
      x >= this.magnetX && x <= this.magnetX + this.magnetWidth &&
      y >= this.magnetY && y <= this.magnetY + this.magnetHeight
    ) {
      this.dragging = true;
      this.dragOffsetX = x - this.magnetX;
      this.dragOffsetY = y - this.magnetY;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging) {
      this.magnetX = x - this.dragOffsetX;
      this.magnetY = y - this.dragOffsetY;
    }
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'coilTurns', label: 'Coil Turns (N)', min: 1, max: 20, step: 1, defaultValue: 10 },
      { type: 'slider', key: 'magnetStrength', label: 'Magnet Strength', min: 0.5, max: 3, step: 0.1, defaultValue: 1 },
      { type: 'toggle', key: 'showFieldLines', label: 'Show Field Lines', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      coilTurns: this.coilTurns,
      magnetStrength: this.magnetStrength,
      showFieldLines: this.showFieldLines,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'coilTurns': this.coilTurns = value as number; break;
      case 'magnetStrength': this.magnetStrength = value as number; break;
      case 'showFieldLines': this.showFieldLines = value as boolean; break;
    }
  }
}

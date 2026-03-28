import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText, drawDashedLine } from '@/engine/render/drawUtils.ts';

export default class LorentzContractionSim extends SimulationEngine {
  private velocity = 0.5;      // fraction of c
  private restLength = 100;    // meters

  // Animation: train scrolls across screen
  private trainX = 0;

  setup(): void {
    this.trainX = 0;
  }

  private gamma(): number {
    return 1 / Math.sqrt(1 - this.velocity * this.velocity);
  }

  private contractedLength(): number {
    return this.restLength / this.gamma();
  }

  update(dt: number): void {
    this.time += dt;
    // Animate train moving across screen
    const speed = this.velocity * 120; // pixels per second visual speed
    this.trainX += speed * dt;
    if (this.trainX > this.width + 200) {
      this.trainX = -this.restLength * this.meterScale() - 100;
    }
  }

  private meterScale(): number {
    // pixels per meter, fit rest length nicely
    return Math.min((this.width * 0.6) / this.restLength, 4);
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    const scale = this.meterScale();
    const g = this.gamma();
    const L0 = this.restLength;
    const L = this.contractedLength();

    const centerX = width / 2;
    const trackY = height * 0.45;
    const trainH = 50;

    // ---- Track / ground line ----
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, trackY + trainH + 5);
    ctx.lineTo(width, trackY + trainH + 5);
    ctx.stroke();

    // ---- Rest frame outline (dashed) centered ----
    const restW = L0 * scale;
    const restX = this.trainX;
    ctx.save();
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(restX, trackY, restW, trainH);
    ctx.setLineDash([]);
    ctx.restore();

    // ---- Contracted train (solid) ----
    const contrW = L * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 10;

    // Draw train body with rounded ends
    const r = Math.min(8, contrW / 4);
    ctx.beginPath();
    ctx.moveTo(restX + r, trackY);
    ctx.lineTo(restX + contrW - r, trackY);
    ctx.arcTo(restX + contrW, trackY, restX + contrW, trackY + r, r);
    ctx.lineTo(restX + contrW, trackY + trainH - r);
    ctx.arcTo(restX + contrW, trackY + trainH, restX + contrW - r, trackY + trainH, r);
    ctx.lineTo(restX + r, trackY + trainH);
    ctx.arcTo(restX, trackY + trainH, restX, trackY + trainH - r, r);
    ctx.lineTo(restX, trackY + r);
    ctx.arcTo(restX, trackY, restX + r, trackY, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Windows on the train
    const windowCount = Math.max(2, Math.floor(contrW / 30));
    const windowW = Math.min(16, contrW / (windowCount * 2));
    const windowH = 14;
    const windowY = trackY + 10;
    ctx.fillStyle = 'rgba(96, 165, 250, 0.3)';
    for (let i = 0; i < windowCount; i++) {
      const wx = restX + (contrW / (windowCount + 1)) * (i + 1) - windowW / 2;
      ctx.fillRect(wx, windowY, windowW, windowH);
    }

    // Wheels
    const wheelR = 8;
    const wheelY = trackY + trainH + 3;
    ctx.fillStyle = '#64748b';
    for (let i = 0; i < 4; i++) {
      const wx = restX + (contrW / 5) * (i + 1);
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Ruler / scale bar ----
    const rulerY = trackY + trainH + 50;
    const rulerLeft = centerX - (L0 * scale) / 2;
    const rulerRight = rulerLeft + L0 * scale;

    // Rest length ruler
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerLeft, rulerY); ctx.lineTo(rulerRight, rulerY);
    ctx.moveTo(rulerLeft, rulerY - 6); ctx.lineTo(rulerLeft, rulerY + 6);
    ctx.moveTo(rulerRight, rulerY - 6); ctx.lineTo(rulerRight, rulerY + 6);
    ctx.stroke();

    // Tick marks every 10m
    for (let m = 0; m <= L0; m += 10) {
      const tx = rulerLeft + m * scale;
      const tickH = m % 50 === 0 ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(tx, rulerY - tickH);
      ctx.lineTo(tx, rulerY + tickH);
      ctx.stroke();
      if (m % 50 === 0) {
        drawText(ctx, `${m}`, tx, rulerY + 16, '#64748b', '9px monospace', 'center');
      }
    }

    drawText(ctx, `L\u2080 = ${L0.toFixed(0)} m (rest)`, (rulerLeft + rulerRight) / 2, rulerY - 14, '#94a3b8', '11px monospace', 'center');

    // Contracted length indicator
    const cRulerY = rulerY + 40;
    const cRulerRight = rulerLeft + L * scale;
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rulerLeft, cRulerY); ctx.lineTo(cRulerRight, cRulerY);
    ctx.moveTo(rulerLeft, cRulerY - 6); ctx.lineTo(rulerLeft, cRulerY + 6);
    ctx.moveTo(cRulerRight, cRulerY - 6); ctx.lineTo(cRulerRight, cRulerY + 6);
    ctx.stroke();

    drawText(ctx, `L = ${L.toFixed(2)} m (contracted)`, (rulerLeft + cRulerRight) / 2, cRulerY - 14, '#f472b6', '11px monospace', 'center');

    // ---- Info overlay ----
    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 230, infoY - 5, 235, 110);
    drawText(ctx, `v/c = ${this.velocity.toFixed(3)}`, infoX, infoY + 12, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `\u03B3 = ${g.toFixed(4)}`, infoX, infoY + 30, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `L\u2080 = ${L0.toFixed(1)} m`, infoX, infoY + 52, '#94a3b8', '12px monospace', 'right');
    drawText(ctx, `L  = ${L.toFixed(2)} m`, infoX, infoY + 70, '#94a3b8', '12px monospace', 'right');
    drawText(ctx, `Contraction: ${((1 - 1 / g) * 100).toFixed(1)}%`, infoX, infoY + 92, '#94a3b8', '12px monospace', 'right');

    // Equation at bottom
    drawText(ctx, 'L = L\u2080 \u221A(1 - v\u00B2/c\u00B2)', width / 2, height - 25, '#64748b', '13px monospace', 'center');
  }

  reset(): void {
    this.trainX = 0;
    this.time = 0;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'velocity', label: 'Velocity', min: 0, max: 0.99, step: 0.01, defaultValue: 0.5, unit: 'c' },
      { type: 'slider', key: 'restLength', label: 'Rest Length L\u2080', min: 50, max: 200, step: 1, defaultValue: 100, unit: 'm' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      velocity: this.velocity,
      restLength: this.restLength,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'velocity':
        this.velocity = value as number;
        break;
      case 'restLength':
        this.restLength = value as number;
        break;
    }
  }
}

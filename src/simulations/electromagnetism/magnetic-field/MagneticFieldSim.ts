import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { Vector2 } from '@/engine/math/Vector2.ts';
import { clearCanvas, drawGrid, drawText, drawArrow } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

type Geometry = 'wire' | 'loop' | 'solenoid';

const MU_0 = 4 * Math.PI * 1e-7; // T m/A
const PIXELS_PER_METER = 200;

export default class MagneticFieldSim extends SimulationEngine {
  private geometry: Geometry = 'wire';
  private current: number = 10;
  private numLoops: number = 5;
  private showFieldLines: boolean = true;
  private showColorMap: boolean = true;

  setup(): void {}

  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);

    switch (this.geometry) {
      case 'wire': this.renderWire(); break;
      case 'loop': this.renderLoop(); break;
      case 'solenoid': this.renderSolenoid(); break;
    }
  }

  // =========== STRAIGHT WIRE ===========
  private renderWire(): void {
    const { ctx, width, height } = this;
    const cx = width / 2;
    const cy = height / 2;

    // Color map
    if (this.showColorMap) {
      this.renderWireColorMap(cx, cy);
    }

    // Field lines (concentric circles)
    if (this.showFieldLines) {
      const numRings = 8;
      for (let i = 1; i <= numRings; i++) {
        const r = i * 35;
        const B = (MU_0 * this.current) / (2 * Math.PI * (r / PIXELS_PER_METER));
        const alpha = Math.min(0.7, B * 1e4);

        ctx.save();
        ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Direction arrows on each ring
        const arrowAngle = this.current > 0 ? Math.PI / 2 : -Math.PI / 2;
        for (let a = 0; a < 4; a++) {
          const theta = (a / 4) * Math.PI * 2 + this.time * 0.5;
          const px = cx + r * Math.cos(theta);
          const py = cy + r * Math.sin(theta);
          const tangent = this.current > 0
            ? new Vector2(-Math.sin(theta), Math.cos(theta))
            : new Vector2(Math.sin(theta), -Math.cos(theta));
          const tipX = px + tangent.x * 10;
          const tipY = py + tangent.y * 10;
          drawArrow(ctx, px, py, tipX, tipY, `rgba(56,189,248,${alpha})`, 1.5, 5);
        }

        // B magnitude label
        const labelAngle = Math.PI * 0.25;
        const lx = cx + r * Math.cos(labelAngle);
        const ly = cy + r * Math.sin(labelAngle);
        const bVal = B >= 1e-3
          ? `${(B * 1e3).toFixed(1)} mT`
          : `${(B * 1e6).toFixed(0)} \u00b5T`;
        drawText(ctx, bVal, lx + 8, ly - 8, 'rgba(56,189,248,0.6)', '10px system-ui', 'left');
      }
    }

    // Draw wire cross-section
    ctx.save();
    // Outer glow
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,204,21,0.2)';
    ctx.fill();

    // Wire body
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, 14);
    grad.addColorStop(0, '#fde68a');
    grad.addColorStop(1, '#b45309');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current direction symbol (dot = out of screen, cross = into screen)
    if (this.current > 0) {
      // Dot (current out of screen)
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    } else {
      // Cross (current into screen)
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 6);
      ctx.lineTo(cx + 6, cy + 6);
      ctx.moveTo(cx + 6, cy - 6);
      ctx.lineTo(cx - 6, cy + 6);
      ctx.stroke();
    }
    ctx.restore();

    // Labels
    drawText(ctx, `B = \u00b5\u2080I / (2\u03c0r)`, width / 2, height - 28,
      'rgba(148,163,184,0.6)', '13px system-ui', 'center');
    drawText(ctx, `I = ${this.current} A (${this.current > 0 ? 'out of' : 'into'} screen)`,
      width / 2, 28, '#fbbf24', 'bold 15px system-ui', 'center');
    drawText(ctx, 'Infinite Straight Wire', width / 2, 50,
      '#94a3b8', '13px system-ui', 'center');
  }

  private renderWireColorMap(cx: number, cy: number): void {
    const { ctx, width, height } = this;
    const step = 10;
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        const dx = x + step / 2 - cx;
        const dy = y + step / 2 - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 16) continue;
        const rMeters = r / PIXELS_PER_METER;
        const B = (MU_0 * Math.abs(this.current)) / (2 * Math.PI * rMeters);
        const norm = Math.min(1, B * 2e4);
        const hue = 200 - norm * 160; // blue to red
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${norm * 0.25})`;
        ctx.fillRect(x, y, step, step);
      }
    }
  }

  // =========== CURRENT LOOP ===========
  private renderLoop(): void {
    const { ctx, width, height } = this;
    const cx = width / 2;
    const cy = height / 2;
    const loopRadius = 100;

    if (this.showColorMap) {
      this.renderLoopColorMap(cx, cy, loopRadius);
    }

    // Draw the loop (cross-section view: two dots where wire crosses the plane)
    const leftX = cx - loopRadius;
    const rightX = cx + loopRadius;

    // Draw field lines using simplified Biot-Savart
    if (this.showFieldLines) {
      this.renderLoopFieldLines(cx, cy, loopRadius);
    }

    // Draw the loop arc (top view hint)
    ctx.save();
    ctx.strokeStyle = 'rgba(250,204,21,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, loopRadius, loopRadius * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Wire cross-sections
    this.drawWireCrossSection(leftX, cy, true);
    this.drawWireCrossSection(rightX, cy, false);

    // Labels
    drawText(ctx, `Current Loop  |  I = ${this.current} A  |  R = ${(loopRadius / PIXELS_PER_METER).toFixed(2)} m`,
      width / 2, 28, '#fbbf24', 'bold 14px system-ui', 'center');
    drawText(ctx, 'B = \u00b5\u2080IR\u00b2 / (2(R\u00b2+x\u00b2)^(3/2))', width / 2, height - 28,
      'rgba(148,163,184,0.6)', '13px system-ui', 'center');
  }

  private drawWireCrossSection(x: number, y: number, currentOut: boolean): void {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,204,21,0.15)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 10);
    grad.addColorStop(0, '#fde68a');
    grad.addColorStop(1, '#b45309');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (currentOut) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
      ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderLoopFieldLines(cx: number, cy: number, loopR: number): void {
    const { ctx } = this;
    const numLines = 12;
    const stepSize = 4;
    const maxSteps = 400;

    for (let i = 0; i < numLines; i++) {
      const startAngle = (i / numLines) * Math.PI * 2;
      // Start from near the loop center
      let px = cx + Math.cos(startAngle) * 15;
      let py = cy + Math.sin(startAngle) * 15;

      ctx.beginPath();
      ctx.moveTo(px, py);

      for (let s = 0; s < maxSteps; s++) {
        // Approximate B field from a loop cross-section
        const { bx, by } = this.loopFieldAt(px - cx, py - cy, loopR);
        const bLen = Math.sqrt(bx * bx + by * by);
        if (bLen < 1e-15) break;

        px += stepSize * (bx / bLen);
        py += stepSize * (by / bLen);

        if (px < 0 || px > this.width || py < 0 || py > this.height) break;

        ctx.lineTo(px, py);
      }

      ctx.strokeStyle = 'rgba(56,189,248,0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  private loopFieldAt(x: number, y: number, R: number): { bx: number; by: number } {
    // Simplified 2D cross-section field of a current loop
    // Two wires at (-R, 0) and (+R, 0) carrying current in opposite directions
    const I = this.current;

    // Left wire (current out of screen) creates clockwise B
    const dx1 = x + R;
    const dy1 = y;
    const r1sq = dx1 * dx1 + dy1 * dy1;
    const r1 = Math.sqrt(r1sq);

    // Right wire (current into screen) creates counter-clockwise B
    const dx2 = x - R;
    const dy2 = y;
    const r2sq = dx2 * dx2 + dy2 * dy2;
    const r2 = Math.sqrt(r2sq);

    const minR = 12;
    let bx = 0, by = 0;

    if (r1 > minR) {
      const B1 = (MU_0 * I) / (2 * Math.PI * (r1 / PIXELS_PER_METER));
      // B perpendicular to radial, CCW
      bx += B1 * (-dy1 / r1);
      by += B1 * (dx1 / r1);
    }

    if (r2 > minR) {
      const B2 = (MU_0 * I) / (2 * Math.PI * (r2 / PIXELS_PER_METER));
      // Opposite direction for current into screen
      bx += B2 * (dy2 / r2);
      by += B2 * (-dx2 / r2);
    }

    return { bx, by };
  }

  private renderLoopColorMap(cx: number, cy: number, loopR: number): void {
    const { ctx, width, height } = this;
    const step = 10;
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        const { bx, by } = this.loopFieldAt(x + step / 2 - cx, y + step / 2 - cy, loopR);
        const mag = Math.sqrt(bx * bx + by * by);
        const norm = Math.min(1, mag * 1e4);
        const hue = 200 - norm * 160;
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${norm * 0.2})`;
        ctx.fillRect(x, y, step, step);
      }
    }
  }

  // =========== SOLENOID ===========
  private renderSolenoid(): void {
    const { ctx, width, height } = this;
    const cx = width / 2;
    const cy = height / 2;
    const solLength = Math.min(width * 0.5, 300);
    const solRadius = 60;
    const halfLen = solLength / 2;

    if (this.showColorMap) {
      this.renderSolenoidColorMap(cx, cy, halfLen, solRadius);
    }

    if (this.showFieldLines) {
      this.renderSolenoidFieldLines(cx, cy, halfLen, solRadius);
    }

    // Draw solenoid coils
    ctx.save();
    const numCoils = this.numLoops;
    for (let i = 0; i <= numCoils; i++) {
      const t = i / numCoils;
      const xPos = cx - halfLen + t * solLength;

      // Ellipse for each coil
      ctx.strokeStyle = 'rgba(250,204,21,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(xPos, cy, 4, solRadius, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Top and bottom lines connecting coils
    ctx.strokeStyle = 'rgba(250,204,21,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - halfLen, cy - solRadius);
    ctx.lineTo(cx + halfLen, cy - solRadius);
    ctx.moveTo(cx - halfLen, cy + solRadius);
    ctx.lineTo(cx + halfLen, cy + solRadius);
    ctx.stroke();

    ctx.restore();

    // B inside label
    const n = this.numLoops / (solLength / PIXELS_PER_METER);
    const Binside = MU_0 * n * this.current;
    const bStr = Binside >= 1e-3
      ? `B = ${(Binside * 1e3).toFixed(2)} mT`
      : `B = ${(Binside * 1e6).toFixed(1)} \u00b5T`;

    drawText(ctx, bStr, cx, cy, '#38bdf8', 'bold 14px system-ui', 'center');
    drawText(ctx, '(uniform inside)', cx, cy + 18, 'rgba(56,189,248,0.5)', '11px system-ui', 'center');

    // Labels
    drawText(ctx, `Solenoid  |  I = ${this.current} A  |  N = ${this.numLoops} turns`,
      width / 2, 28, '#fbbf24', 'bold 14px system-ui', 'center');
    drawText(ctx, 'B = \u00b5\u2080nI  (inside)', width / 2, height - 28,
      'rgba(148,163,184,0.6)', '13px system-ui', 'center');
  }

  private renderSolenoidFieldLines(cx: number, cy: number, halfLen: number, solRadius: number): void {
    const { ctx } = this;

    // Inside: horizontal lines
    const numInside = 6;
    for (let i = 0; i < numInside; i++) {
      const yOff = ((i + 0.5) / numInside - 0.5) * solRadius * 1.6;
      ctx.save();
      ctx.strokeStyle = 'rgba(56,189,248,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - halfLen - 20, cy + yOff);
      ctx.lineTo(cx + halfLen + 20, cy + yOff);
      ctx.stroke();
      ctx.restore();

      // Arrow
      drawArrow(ctx, cx - 10, cy + yOff, cx + 10, cy + yOff,
        'rgba(56,189,248,0.6)', 1.5, 6);
    }

    // Outside: curved lines wrapping around (dipole-like)
    const numOutside = 5;
    for (let i = 0; i < numOutside; i++) {
      const spread = (i + 1) * 30;
      ctx.save();
      ctx.strokeStyle = 'rgba(56,189,248,0.25)';
      ctx.lineWidth = 1;

      // Top curve
      ctx.beginPath();
      ctx.moveTo(cx + halfLen + 20, cy);
      ctx.bezierCurveTo(
        cx + halfLen + 40 + spread, cy - solRadius - spread,
        cx - halfLen - 40 - spread, cy - solRadius - spread,
        cx - halfLen - 20, cy
      );
      ctx.stroke();

      // Bottom curve
      ctx.beginPath();
      ctx.moveTo(cx + halfLen + 20, cy);
      ctx.bezierCurveTo(
        cx + halfLen + 40 + spread, cy + solRadius + spread,
        cx - halfLen - 40 - spread, cy + solRadius + spread,
        cx - halfLen - 20, cy
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderSolenoidColorMap(cx: number, cy: number, halfLen: number, solRadius: number): void {
    const { ctx, width, height } = this;
    const step = 10;
    const n = this.numLoops / ((halfLen * 2) / PIXELS_PER_METER);
    const Binside = MU_0 * n * this.current;

    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        const dx = (x + step / 2) - cx;
        const dy = (y + step / 2) - cy;
        const inside = Math.abs(dx) < halfLen && Math.abs(dy) < solRadius;

        let B: number;
        if (inside) {
          B = Binside;
        } else {
          // Approximate dipole falloff outside
          const dist = Math.sqrt(dx * dx + dy * dy);
          B = Binside * Math.pow(halfLen / Math.max(dist, halfLen), 3) * 0.3;
        }

        const norm = Math.min(1, Math.abs(B) * 1e4);
        if (norm < 0.01) continue;
        const hue = 200 - norm * 160;
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${norm * 0.2})`;
        ctx.fillRect(x, y, step, step);
      }
    }
  }

  reset(): void {
    this.geometry = 'wire';
    this.current = 10;
    this.numLoops = 5;
    this.showFieldLines = true;
    this.showColorMap = true;
    this.time = 0;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown', key: 'geometry', label: 'Geometry',
        options: [
          { value: 'wire', label: 'Straight Wire' },
          { value: 'loop', label: 'Current Loop' },
          { value: 'solenoid', label: 'Solenoid' },
        ],
        defaultValue: 'wire',
      },
      { type: 'slider', key: 'current', label: 'Current', min: 1, max: 20, step: 1, defaultValue: 10, unit: 'A' },
      { type: 'slider', key: 'numLoops', label: 'Number of Loops', min: 1, max: 20, step: 1, defaultValue: 5 },
      { type: 'toggle', key: 'showFieldLines', label: 'Field Lines', defaultValue: true },
      { type: 'toggle', key: 'showColorMap', label: 'Magnitude Color Map', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      geometry: this.geometry,
      current: this.current,
      numLoops: this.numLoops,
      showFieldLines: this.showFieldLines,
      showColorMap: this.showColorMap,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'geometry': this.geometry = value as Geometry; break;
      case 'current': this.current = value as number; break;
      case 'numLoops': this.numLoops = value as number; break;
      case 'showFieldLines': this.showFieldLines = value as boolean; break;
      case 'showColorMap': this.showColorMap = value as boolean; break;
    }
  }
}

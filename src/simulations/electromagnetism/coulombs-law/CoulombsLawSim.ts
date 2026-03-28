import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { Vector2 } from '@/engine/math/Vector2.ts';
import { clearCanvas, drawGrid, drawArrow, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

interface Charge {
  pos: Vector2;
  q: number; // microcoulombs
}

const K_COULOMB = 8.99e9; // N m²/C²
const PIXELS_PER_METER = 100;
const CHARGE_RADIUS = 22;

export default class CoulombsLawSim extends SimulationEngine {
  private charges: Charge[] = [];
  private charge1: number = 5;
  private charge2: number = -3;
  private showForceVectors: boolean = true;
  private showFieldLines: boolean = false;
  private dragging: number = -1;
  private dragOffset: Vector2 = new Vector2();

  setup(): void {
    this.charges = [
      { pos: new Vector2(this.width * 0.35, this.height * 0.5), q: this.charge1 },
      { pos: new Vector2(this.width * 0.65, this.height * 0.5), q: this.charge2 },
    ];
  }

  update(dt: number): void {
    this.time += dt;
    this.charges[0].q = this.charge1;
    this.charges[1].q = this.charge2;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);

    if (this.showFieldLines) {
      this.renderFieldLines();
    }

    // Compute Coulomb force
    const c1 = this.charges[0];
    const c2 = this.charges[1];
    const delta = c2.pos.sub(c1.pos);
    const rPixels = delta.length();
    const rMeters = rPixels / PIXELS_PER_METER;
    const q1C = c1.q * 1e-6;
    const q2C = c2.q * 1e-6;

    let forceMag = 0;
    let forceDir = new Vector2();
    if (rMeters > 0.01) {
      forceMag = K_COULOMB * Math.abs(q1C * q2C) / (rMeters * rMeters);
      forceDir = delta.normalize();
    }

    // Draw connection line
    ctx.save();
    ctx.strokeStyle = 'rgba(148,163,184,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(c1.pos.x, c1.pos.y);
    ctx.lineTo(c2.pos.x, c2.pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw distance label
    const midX = (c1.pos.x + c2.pos.x) / 2;
    const midY = (c1.pos.y + c2.pos.y) / 2;
    drawText(ctx, `r = ${rMeters.toFixed(2)} m`, midX, midY - 18,
      '#94a3b8', '13px system-ui', 'center');

    // Draw force vectors
    if (this.showForceVectors && forceMag > 0 && rMeters > 0.01) {
      const attractive = q1C * q2C < 0;
      const scaledLen = Math.min(Math.log10(forceMag + 1) * 30, 150);

      // Force on charge 1
      const f1Dir = attractive ? forceDir : forceDir.scale(-1);
      const f1End = c1.pos.add(f1Dir.scale(scaledLen));
      drawArrow(ctx, c1.pos.x, c1.pos.y, f1End.x, f1End.y, '#facc15', 3, 12);

      // Force on charge 2
      const f2Dir = attractive ? forceDir.scale(-1) : forceDir;
      const f2End = c2.pos.add(f2Dir.scale(scaledLen));
      drawArrow(ctx, c2.pos.x, c2.pos.y, f2End.x, f2End.y, '#facc15', 3, 12);
    }

    // Draw charges
    this.drawCharge(c1, 'q\u2081');
    this.drawCharge(c2, 'q\u2082');

    // Force magnitude display
    const forceStr = forceMag >= 1e3
      ? `F = ${(forceMag / 1e3).toFixed(2)} kN`
      : forceMag >= 1
        ? `F = ${forceMag.toFixed(2)} N`
        : `F = ${(forceMag * 1e3).toFixed(2)} mN`;

    const typeStr = q1C * q2C < 0 ? '(attractive)' : q1C * q2C > 0 ? '(repulsive)' : '';

    drawText(ctx, forceStr, width / 2, 36, '#fbbf24', 'bold 18px system-ui', 'center');
    drawText(ctx, typeStr, width / 2, 58, '#94a3b8', '14px system-ui', 'center');

    // Equation
    drawText(ctx, 'F = k|q\u2081q\u2082| / r\u00b2', width / 2, height - 28,
      'rgba(148,163,184,0.6)', '13px system-ui', 'center');
  }

  private drawCharge(c: Charge, label: string): void {
    const { ctx } = this;
    const positive = c.q >= 0;
    const color = positive ? '#ef4444' : '#3b82f6';
    const glowColor = positive ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)';

    // Glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, CHARGE_RADIUS + 10, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, CHARGE_RADIUS, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      c.pos.x - 5, c.pos.y - 5, 2,
      c.pos.x, c.pos.y, CHARGE_RADIUS
    );
    grad.addColorStop(0, positive ? '#fca5a5' : '#93c5fd');
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Sign
    drawText(ctx, positive ? '+' : '\u2212', c.pos.x, c.pos.y,
      '#fff', 'bold 20px system-ui', 'center');

    // Label below
    drawText(ctx, `${label} = ${c.q.toFixed(1)} \u00b5C`, c.pos.x, c.pos.y + CHARGE_RADIUS + 18,
      '#e2e8f0', '13px system-ui', 'center');
  }

  private renderFieldLines(): void {
    const { ctx, charges } = this;
    const NUM_LINES = 12;

    for (const charge of charges) {
      if (Math.abs(charge.q) < 0.1) continue;

      for (let i = 0; i < NUM_LINES; i++) {
        const angle = (i / NUM_LINES) * Math.PI * 2;
        const startR = CHARGE_RADIUS + 4;
        let px = charge.pos.x + Math.cos(angle) * startR;
        let py = charge.pos.y + Math.sin(angle) * startR;
        const stepSize = 5;
        const maxSteps = 200;
        const sign = charge.q > 0 ? 1 : -1;

        ctx.beginPath();
        ctx.moveTo(px, py);

        for (let s = 0; s < maxSteps; s++) {
          let Ex = 0, Ey = 0;
          for (const c of charges) {
            const dx = px - c.pos.x;
            const dy = py - c.pos.y;
            const r2 = dx * dx + dy * dy;
            const r = Math.sqrt(r2);
            if (r < CHARGE_RADIUS * 0.8) break;
            const eMag = (Math.abs(c.q) * 1e-6 * K_COULOMB) / r2;
            const eSign = c.q > 0 ? 1 : -1;
            Ex += eSign * eMag * (dx / r);
            Ey += eSign * eMag * (dy / r);
          }
          const eLen = Math.sqrt(Ex * Ex + Ey * Ey);
          if (eLen < 1e-10) break;

          px += sign * stepSize * (Ex / eLen);
          py += sign * stepSize * (Ey / eLen);

          if (px < 0 || px > this.width || py < 0 || py > this.height) break;

          // Check if we reached another charge
          let hitCharge = false;
          for (const c of charges) {
            if (c === charge) continue;
            const dist = Math.sqrt((px - c.pos.x) ** 2 + (py - c.pos.y) ** 2);
            if (dist < CHARGE_RADIUS) { hitCharge = true; break; }
          }

          ctx.lineTo(px, py);
          if (hitCharge) break;
        }

        ctx.strokeStyle = 'rgba(56,189,248,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  reset(): void {
    this.charge1 = 5;
    this.charge2 = -3;
    this.showForceVectors = true;
    this.showFieldLines = false;
    this.time = 0;
    this.setup();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'charge1', label: 'Charge q\u2081', min: -10, max: 10, step: 0.5, defaultValue: 5, unit: '\u00b5C' },
      { type: 'slider', key: 'charge2', label: 'Charge q\u2082', min: -10, max: 10, step: 0.5, defaultValue: -3, unit: '\u00b5C' },
      { type: 'toggle', key: 'showForceVectors', label: 'Force Vectors', defaultValue: true },
      { type: 'toggle', key: 'showFieldLines', label: 'Field Lines', defaultValue: false },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      charge1: this.charge1,
      charge2: this.charge2,
      showForceVectors: this.showForceVectors,
      showFieldLines: this.showFieldLines,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'charge1': this.charge1 = value as number; break;
      case 'charge2': this.charge2 = value as number; break;
      case 'showForceVectors': this.showForceVectors = value as boolean; break;
      case 'showFieldLines': this.showFieldLines = value as boolean; break;
    }
  }

  onPointerDown(x: number, y: number): void {
    for (let i = 0; i < this.charges.length; i++) {
      const dist = new Vector2(x, y).distanceTo(this.charges[i].pos);
      if (dist < CHARGE_RADIUS + 10) {
        this.dragging = i;
        this.dragOffset = this.charges[i].pos.sub(new Vector2(x, y));
        return;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging >= 0) {
      const margin = CHARGE_RADIUS + 5;
      const nx = Math.max(margin, Math.min(this.width - margin, x + this.dragOffset.x));
      const ny = Math.max(margin, Math.min(this.height - margin, y + this.dragOffset.y));
      this.charges[this.dragging].pos = new Vector2(nx, ny);
    }
  }

  onPointerUp(): void {
    this.dragging = -1;
  }
}

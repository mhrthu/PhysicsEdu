import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { Vector2 } from '@/engine/math/Vector2.ts';
import { clearCanvas, drawGrid, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

interface PointCharge {
  pos: Vector2;
  q: number; // signed magnitude
}

const K = 8.99e9;
const CHARGE_RADIUS = 16;
const LINE_STEP = 4;
const MAX_LINE_STEPS = 500;
const LINES_PER_UC = 8;

export default class ElectricFieldLinesSim extends SimulationEngine {
  private charges: PointCharge[] = [];
  private chargeMagnitude: number = 3;
  private showEquipotential: boolean = false;
  private showColorMap: boolean = false;
  private nextSign: number = 1; // +1 or -1 for pending add

  setup(): void {
    // Start with a dipole
    this.charges = [
      { pos: new Vector2(this.width * 0.35, this.height * 0.5), q: 3 },
      { pos: new Vector2(this.width * 0.65, this.height * 0.5), q: -3 },
    ];
  }

  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);

    if (this.showColorMap) {
      this.renderFieldColorMap();
    }

    this.renderFieldLines();

    if (this.showEquipotential) {
      this.renderEquipotentialLines();
    }

    // Draw charges on top
    for (const c of this.charges) {
      this.drawCharge(c);
    }

    // Instructions
    drawText(ctx, 'Use controls to add charges. Click canvas to place.',
      width / 2, height - 20, 'rgba(148,163,184,0.5)', '12px system-ui', 'center');
    drawText(ctx, `Charges: ${this.charges.length}`, 14, 24, '#94a3b8', '13px system-ui', 'left');
  }

  private electricField(px: number, py: number): Vector2 {
    let Ex = 0, Ey = 0;
    for (const c of this.charges) {
      const dx = px - c.pos.x;
      const dy = py - c.pos.y;
      const r2 = dx * dx + dy * dy;
      if (r2 < CHARGE_RADIUS * CHARGE_RADIUS * 0.5) continue;
      const r = Math.sqrt(r2);
      const eMag = (K * Math.abs(c.q) * 1e-6) / r2;
      const sign = c.q > 0 ? 1 : -1;
      Ex += sign * eMag * (dx / r);
      Ey += sign * eMag * (dy / r);
    }
    return new Vector2(Ex, Ey);
  }

  private potential(px: number, py: number): number {
    let V = 0;
    for (const c of this.charges) {
      const dx = px - c.pos.x;
      const dy = py - c.pos.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < CHARGE_RADIUS) continue;
      V += (K * c.q * 1e-6) / r;
    }
    return V;
  }

  private renderFieldLines(): void {
    const { ctx, charges } = this;
    if (charges.length === 0) return;

    for (const charge of charges) {
      if (charge.q === 0) continue;
      const numLines = Math.max(4, Math.round(Math.abs(charge.q) * LINES_PER_UC));
      const sign = charge.q > 0 ? 1 : -1;

      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        let px = charge.pos.x + Math.cos(angle) * (CHARGE_RADIUS + 3);
        let py = charge.pos.y + Math.sin(angle) * (CHARGE_RADIUS + 3);

        ctx.beginPath();
        ctx.moveTo(px, py);

        let terminated = false;
        for (let s = 0; s < MAX_LINE_STEPS; s++) {
          const E = this.electricField(px, py);
          const eLen = E.length();
          if (eLen < 1e-6) break;

          px += sign * LINE_STEP * (E.x / eLen);
          py += sign * LINE_STEP * (E.y / eLen);

          if (px < -20 || px > this.width + 20 || py < -20 || py > this.height + 20) break;

          // Check termination at opposite charge
          for (const c of charges) {
            if (c === charge) continue;
            const d = Math.sqrt((px - c.pos.x) ** 2 + (py - c.pos.y) ** 2);
            if (d < CHARGE_RADIUS) { terminated = true; break; }
          }

          ctx.lineTo(px, py);
          if (terminated) break;
        }

        // Color by local potential: positive region = warm, negative = cool
        const midPot = this.potential(px, py);
        const potNorm = Math.tanh(midPot / 2e4); // -1 to 1
        const hue = potNorm > 0 ? 20 - potNorm * 20 : 220 + potNorm * 20; // warm→cool
        const sat = 70 + Math.abs(potNorm) * 20;
        ctx.strokeStyle = `hsla(${hue}, ${sat}%, 60%, 0.55)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw arrowhead midway
        if (!terminated) continue;
        // Small arrow at midpoint
      }
    }
  }

  private renderFieldColorMap(): void {
    const { ctx, width, height } = this;
    const step = 12;
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        const E = this.electricField(x + step / 2, y + step / 2);
        const mag = E.length();
        const normalized = Math.min(1, Math.log10(mag + 1) / 12);
        const r = Math.round(normalized * 200);
        const g = Math.round((1 - normalized) * 40 + normalized * 80);
        const b = Math.round((1 - normalized) * 100 + normalized * 20);
        ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
        ctx.fillRect(x, y, step, step);
      }
    }
  }

  private renderEquipotentialLines(): void {
    const { ctx, width, height } = this;
    if (this.charges.length === 0) return;

    // Marching squares for many equipotential levels
    const step = 6;
    // Logarithmically spaced levels for better coverage near charges
    const levels: number[] = [];
    for (const sign of [-1, 1]) {
      for (const v of [200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5]) {
        levels.push(sign * v);
      }
    }
    levels.push(0);
    const cols = Math.ceil(width / step);
    const rows = Math.ceil(height / step);

    // Precompute potential grid
    const grid: number[][] = [];
    for (let j = 0; j <= rows; j++) {
      grid[j] = [];
      for (let i = 0; i <= cols; i++) {
        grid[j][i] = this.potential(i * step, j * step);
      }
    }

    ctx.save();
    ctx.lineWidth = 1;

    for (const level of levels) {
      const hue = level > 0 ? 0 : level < 0 ? 220 : 120;
      ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.35)`;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const v00 = grid[j][i];
          const v10 = grid[j][i + 1];
          const v01 = grid[j + 1][i];
          const v11 = grid[j + 1][i + 1];

          const pts: [number, number][] = [];

          // Check edges for crossings
          if ((v00 - level) * (v10 - level) < 0) {
            const t = (level - v00) / (v10 - v00);
            pts.push([(i + t) * step, j * step]);
          }
          if ((v10 - level) * (v11 - level) < 0) {
            const t = (level - v10) / (v11 - v10);
            pts.push([(i + 1) * step, (j + t) * step]);
          }
          if ((v01 - level) * (v11 - level) < 0) {
            const t = (level - v01) / (v11 - v01);
            pts.push([(i + t) * step, (j + 1) * step]);
          }
          if ((v00 - level) * (v01 - level) < 0) {
            const t = (level - v00) / (v01 - v00);
            pts.push([i * step, (j + t) * step]);
          }

          if (pts.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            ctx.lineTo(pts[1][0], pts[1][1]);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  private drawCharge(c: PointCharge): void {
    const { ctx } = this;
    const positive = c.q > 0;
    const color = positive ? '#ef4444' : '#3b82f6';

    ctx.save();
    // Glow
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, CHARGE_RADIUS + 8, 0, Math.PI * 2);
    ctx.fillStyle = positive ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, CHARGE_RADIUS, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      c.pos.x - 3, c.pos.y - 3, 2, c.pos.x, c.pos.y, CHARGE_RADIUS
    );
    grad.addColorStop(0, positive ? '#fca5a5' : '#93c5fd');
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    drawText(ctx, positive ? '+' : '\u2212', c.pos.x, c.pos.y,
      '#fff', 'bold 16px system-ui', 'center');
  }

  reset(): void {
    this.chargeMagnitude = 3;
    this.showEquipotential = false;
    this.showColorMap = false;
    this.nextSign = 1;
    this.time = 0;
    this.setup();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'chargeMagnitude', label: 'Charge Magnitude', min: 1, max: 10, step: 1, defaultValue: 3, unit: '\u00b5C' },
      { type: 'toggle', key: 'showEquipotential', label: 'Equipotential Lines', defaultValue: false },
      { type: 'toggle', key: 'showColorMap', label: 'Field Color Map', defaultValue: false },
      { type: 'button', key: 'addPositive', label: 'Add Positive Charge' },
      { type: 'button', key: 'addNegative', label: 'Add Negative Charge' },
      { type: 'button', key: 'clearAll', label: 'Clear All Charges' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      chargeMagnitude: this.chargeMagnitude,
      showEquipotential: this.showEquipotential,
      showColorMap: this.showColorMap,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'chargeMagnitude': this.chargeMagnitude = value as number; break;
      case 'showEquipotential': this.showEquipotential = value as boolean; break;
      case 'showColorMap': this.showColorMap = value as boolean; break;
      case 'addPositive': this.nextSign = 1; this.placeCharge(1); break;
      case 'addNegative': this.nextSign = -1; this.placeCharge(-1); break;
      case 'clearAll': this.charges = []; break;
    }
  }

  private placeCharge(sign: number): void {
    // Place at a random reasonable position
    const margin = 60;
    const x = margin + Math.random() * (this.width - margin * 2);
    const y = margin + Math.random() * (this.height - margin * 2);
    this.charges.push({ pos: new Vector2(x, y), q: sign * this.chargeMagnitude });
  }

  onPointerDown(x: number, y: number): void {
    // Check if clicking near existing charge for dragging
    for (let i = 0; i < this.charges.length; i++) {
      const d = new Vector2(x, y).distanceTo(this.charges[i].pos);
      if (d < CHARGE_RADIUS + 8) {
        (this as any)._dragIdx = i;
        return;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    const idx = (this as any)._dragIdx;
    if (idx !== undefined && idx >= 0) {
      this.charges[idx].pos = new Vector2(
        Math.max(CHARGE_RADIUS, Math.min(this.width - CHARGE_RADIUS, x)),
        Math.max(CHARGE_RADIUS, Math.min(this.height - CHARGE_RADIUS, y))
      );
    }
  }

  onPointerUp(): void {
    (this as any)._dragIdx = undefined;
  }
}

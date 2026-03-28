import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

interface Atom {
  decayed: boolean;
  decayTime: number; // -1 if not yet decayed
  gridX: number;
  gridY: number;
}

interface DataPoint {
  t: number;
  n: number;
}

type IsotopePreset = 'C-14' | 'U-238' | 'I-131';

export default class NuclearDecaySim extends SimulationEngine {
  /* --- controls --- */
  private atomCount = 200;
  private halfLife = 3;
  private showGrid = true;
  private showCurve = true;
  private isotopePreset: IsotopePreset = 'C-14';

  /* --- state --- */
  private atoms: Atom[] = [];
  private remaining = 0;
  private dataPoints: DataPoint[] = [];
  private sampleInterval = 0.1;
  private sampleTimer = 0;

  setup(): void {
    this.initAtoms();
  }

  private initAtoms(): void {
    this.time = 0;
    this.sampleTimer = 0;
    const count = this.atomCount;
    this.atoms = [];
    this.dataPoints = [{ t: 0, n: count }];

    const cols = Math.ceil(Math.sqrt(count * 1.5));
    const rows = Math.ceil(count / cols);
    let idx = 0;
    for (let r = 0; r < rows && idx < count; r++) {
      for (let c = 0; c < cols && idx < count; c++) {
        this.atoms.push({
          decayed: false,
          decayTime: -1,
          gridX: c,
          gridY: r,
        });
        idx++;
      }
    }
    this.remaining = count;
  }

  update(dt: number): void {
    this.time += dt;

    // Decay probability per frame: P = 1 - exp(-lambda * dt)
    const lambda = Math.LN2 / this.halfLife;
    const pDecay = 1 - Math.exp(-lambda * dt);

    for (const atom of this.atoms) {
      if (atom.decayed) continue;
      if (Math.random() < pDecay) {
        atom.decayed = true;
        atom.decayTime = this.time;
        this.remaining--;
      }
    }

    // Record data points
    this.sampleTimer += dt;
    if (this.sampleTimer >= this.sampleInterval) {
      this.sampleTimer -= this.sampleInterval;
      this.dataPoints.push({ t: this.time, n: this.remaining });
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50);

    const splitX = this.showGrid && this.showCurve ? width * 0.5 : width;
    const curveX = this.showGrid ? splitX : 0;
    const curveW = width - curveX;

    // --- Atom grid view ---
    if (this.showGrid) {
      this.renderAtomGrid(ctx, 0, 0, splitX, height);
    }

    // --- Decay curve ---
    if (this.showCurve) {
      this.renderDecayCurve(ctx, curveX, 0, curveW, height);
    }

    // --- Divider ---
    if (this.showGrid && this.showCurve) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.stroke();
    }

    // --- Top info bar ---
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, 10, 260, 52);
    drawText(ctx, `Remaining: ${this.remaining} / ${this.atomCount}`, 20, 28, '#22c55e', '13px monospace', 'left');
    drawText(ctx, `t = ${this.time.toFixed(1)}s   t\u00BD = ${this.halfLife.toFixed(1)}s`, 20, 48, '#94a3b8', '12px monospace', 'left');

    // Preset label
    const presetLabels: Record<IsotopePreset, string> = {
      'C-14': 'Carbon-14',
      'U-238': 'Uranium-238',
      'I-131': 'Iodine-131',
    };
    drawText(ctx, presetLabels[this.isotopePreset], width - 15, 25, '#a78bfa', '12px system-ui', 'right');
  }

  private renderAtomGrid(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number): void {
    if (this.atoms.length === 0) return;

    const padding = 30;
    const top = oy + 70;
    const areaW = w - 2 * padding;
    const areaH = h - top - padding;

    const maxGX = Math.max(...this.atoms.map((a) => a.gridX)) + 1;
    const maxGY = Math.max(...this.atoms.map((a) => a.gridY)) + 1;
    const cellW = Math.min(areaW / maxGX, areaH / maxGY, 20);
    const radius = Math.max(2, cellW * 0.35);

    const gridW = maxGX * cellW;
    const gridH = maxGY * cellW;
    const startX = ox + padding + (areaW - gridW) / 2;
    const startY = top + (areaH - gridH) / 2;

    for (const atom of this.atoms) {
      const cx = startX + atom.gridX * cellW + cellW / 2;
      const cy = startY + atom.gridY * cellW + cellW / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);

      if (atom.decayed) {
        // Decayed: red with fade based on how recently it decayed
        const age = this.time - atom.decayTime;
        const flash = Math.max(0, 1 - age * 2);
        ctx.fillStyle = flash > 0
          ? `rgba(239, 68, 68, ${0.4 + flash * 0.6})`
          : 'rgba(239, 68, 68, 0.35)';
        ctx.fill();
        if (flash > 0) {
          // Glow effect for recently decayed
          ctx.beginPath();
          ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 5);
          glow.addColorStop(0, `rgba(239, 68, 68, ${flash * 0.4})`);
          glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = glow;
          ctx.fill();
        }
      } else {
        // Undecayed: bright green
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    drawText(ctx, 'Atom Grid', ox + w / 2, top - 15, '#94a3b8', '12px system-ui', 'center');
  }

  private renderDecayCurve(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, w: number, h: number,
  ): void {
    const padding = { left: 60, right: 20, top: 70, bottom: 50 };
    const plotX = ox + padding.left;
    const plotY = oy + padding.top;
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Time range: show at least 5 half-lives or current time
    const tMax = Math.max(this.halfLife * 5, this.time * 1.1, 5);
    const nMax = this.atomCount;

    const toSX = (t: number) => plotX + (t / tMax) * plotW;
    const toSY = (n: number) => plotY + plotH - (n / nMax) * plotH;

    // --- Axes ---
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Y-axis ticks
    for (let frac = 0; frac <= 1; frac += 0.25) {
      const n = nMax * frac;
      const sy = toSY(n);
      drawDashedLine(ctx, plotX - 5, sy, plotX + plotW, sy, 'rgba(71, 85, 105, 0.3)', 1, [3, 3]);
      drawText(ctx, `${Math.round(n)}`, plotX - 8, sy, '#64748b', '10px monospace', 'right');
    }

    // X-axis ticks (half-lives)
    for (let hl = 0; hl <= 5; hl++) {
      const t = hl * this.halfLife;
      if (t > tMax) break;
      const sx = toSX(t);
      drawDashedLine(ctx, sx, plotY, sx, plotY + plotH + 5, 'rgba(71, 85, 105, 0.3)', 1, [3, 3]);
      drawText(ctx, `${hl}t\u00BD`, sx, plotY + plotH + 18, '#64748b', '10px monospace', 'center');
    }

    // --- Theoretical curve N(t) = N0 * (1/2)^(t/t1/2) ---
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * tMax;
      const n = nMax * Math.pow(0.5, t / this.halfLife);
      const sx = toSX(t);
      const sy = toSY(n);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // --- Actual data points ---
    ctx.fillStyle = '#60a5fa';
    for (const dp of this.dataPoints) {
      const sx = toSX(dp.t);
      const sy = toSY(dp.n);
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current point highlight
    if (this.dataPoints.length > 0) {
      const last = this.dataPoints[this.dataPoints.length - 1];
      const sx = toSX(last.t);
      const sy = toSY(last.n);
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // --- Legend ---
    const legX = plotX + plotW - 140;
    const legY = plotY + 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(legX - 5, legY - 5, 145, 45);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(legX, legY + 5, 12, 3);
    drawText(ctx, 'N\u2080(1/2)^{t/t\u00BD}', legX + 18, legY + 8, '#f59e0b', '11px monospace', 'left');

    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(legX + 5, legY + 28, 3, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, 'Measured N(t)', legX + 18, legY + 28, '#60a5fa', '11px monospace', 'left');

    // Axis labels
    drawText(ctx, 'N(t)', plotX - 40, plotY + plotH / 2, '#94a3b8', '13px system-ui', 'center');
    drawText(ctx, 'Time', plotX + plotW / 2, plotY + plotH + 38, '#94a3b8', '13px system-ui', 'center');
    drawText(ctx, 'Decay Curve', ox + w / 2, plotY - 15, '#94a3b8', '12px system-ui', 'center');
  }

  reset(): void {
    this.initAtoms();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'atomCount', label: 'Atom Count', min: 50, max: 500, step: 10, defaultValue: 200 },
      { type: 'slider', key: 'halfLife', label: 'Half-Life', min: 1, max: 10, step: 0.5, defaultValue: 3, unit: 's' },
      { type: 'toggle', key: 'showGrid', label: 'Atom Grid', defaultValue: true },
      { type: 'toggle', key: 'showCurve', label: 'Decay Curve', defaultValue: true },
      {
        type: 'dropdown', key: 'isotopePreset', label: 'Isotope Preset', defaultValue: 'C-14',
        options: [
          { value: 'C-14', label: 'Carbon-14' },
          { value: 'U-238', label: 'Uranium-238' },
          { value: 'I-131', label: 'Iodine-131' },
        ],
      },
      { type: 'button', key: 'reset', label: 'Reset' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      atomCount: this.atomCount,
      halfLife: this.halfLife,
      showGrid: this.showGrid,
      showCurve: this.showCurve,
      isotopePreset: this.isotopePreset,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'atomCount':
        this.atomCount = value as number;
        this.initAtoms();
        break;
      case 'halfLife':
        this.halfLife = value as number;
        break;
      case 'showGrid':
        this.showGrid = value as boolean;
        break;
      case 'showCurve':
        this.showCurve = value as boolean;
        break;
      case 'isotopePreset': {
        this.isotopePreset = value as IsotopePreset;
        // Apply preset half-lives (scaled for sim time)
        const presetHalfLives: Record<IsotopePreset, number> = {
          'C-14': 5,
          'U-238': 8,
          'I-131': 2,
        };
        this.halfLife = presetHalfLives[this.isotopePreset];
        this.initAtoms();
        break;
      }
      case 'reset':
        this.initAtoms();
        break;
    }
  }
}

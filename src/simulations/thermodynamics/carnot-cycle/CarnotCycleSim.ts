import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawArrow, drawGrid, drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

// Carnot cycle operates between T_hot and T_cold with an ideal gas
// Four processes: isothermal expansion, adiabatic expansion,
// isothermal compression, adiabatic compression

interface CyclePoint {
  V: number;
  P: number;
  T: number;
  S: number;
}

export default class CarnotCycleSim extends SimulationEngine {
  private tHot = 600;
  private tCold = 300;
  private showTSDiagram = true;

  // Cycle parameters
  private readonly n = 1; // moles
  private readonly R = 8.314;
  private readonly gamma = 5 / 3; // monatomic ideal gas
  private readonly Cv = 3 / 2 * 8.314; // per mole

  // Animation
  private cyclePhase = 0; // 0..4 (4 processes)
  private phaseProgress = 0; // 0..1 within current process
  private animSpeed = 0.4;

  // Precomputed cycle points A, B, C, D
  private points: CyclePoint[] = [];
  // Full cycle path for rendering
  private pvPath: { V: number; P: number }[] = [];
  private tsPath: { T: number; S: number }[] = [];

  setup(): void {
    this.computeCycle();
  }

  private computeCycle(): void {
    const { n, R, gamma, tHot, tCold, Cv } = this;

    // State A: start of isothermal expansion at T_hot
    const V_A = 1.0; // m^3 (reference)
    const P_A = n * R * tHot / V_A;

    // State B: end of isothermal expansion at T_hot
    const V_B = 2.5 * V_A; // expansion ratio
    const P_B = n * R * tHot / V_B;

    // State C: end of adiabatic expansion (reaches T_cold)
    // T_hot * V_B^(gamma-1) = T_cold * V_C^(gamma-1)
    const V_C = V_B * Math.pow(tHot / tCold, 1 / (gamma - 1));
    const P_C = n * R * tCold / V_C;

    // State D: end of isothermal compression at T_cold
    // Adiabatic from D to A: T_cold * V_D^(gamma-1) = T_hot * V_A^(gamma-1)
    const V_D = V_A * Math.pow(tHot / tCold, 1 / (gamma - 1));
    const P_D = n * R * tCold / V_D;

    // Entropy reference: S_A = 0
    const S_A = 0;
    const S_B = S_A + n * R * Math.log(V_B / V_A); // isothermal at T_hot
    const S_C = S_B; // adiabatic (isentropic)
    const S_D = S_A; // adiabatic back

    this.points = [
      { V: V_A, P: P_A, T: tHot, S: S_A },
      { V: V_B, P: P_B, T: tHot, S: S_B },
      { V: V_C, P: P_C, T: tCold, S: S_C },
      { V: V_D, P: P_D, T: tCold, S: S_D },
    ];

    // Generate smooth PV path
    this.pvPath = [];
    this.tsPath = [];
    const steps = 60;

    // Process 1: A->B isothermal expansion at T_hot
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const V = V_A + frac * (V_B - V_A);
      const P = n * R * tHot / V;
      const S = S_A + n * R * Math.log(V / V_A);
      this.pvPath.push({ V, P });
      this.tsPath.push({ T: tHot, S });
    }
    // Process 2: B->C adiabatic expansion
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const V = V_B + frac * (V_C - V_B);
      const T = tHot * Math.pow(V_B / V, gamma - 1);
      const P = n * R * T / V;
      const S = S_B; // isentropic
      this.pvPath.push({ V, P });
      this.tsPath.push({ T, S });
    }
    // Process 3: C->D isothermal compression at T_cold
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const V = V_C + frac * (V_D - V_C);
      const P = n * R * tCold / V;
      const S = S_B + n * R * Math.log(V / V_C);
      this.pvPath.push({ V, P });
      this.tsPath.push({ T: tCold, S });
    }
    // Process 4: D->A adiabatic compression
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const V = V_D + frac * (V_A - V_D);
      const T = tCold * Math.pow(V_D / V, gamma - 1);
      const P = n * R * T / V;
      const S = S_D; // isentropic
      this.pvPath.push({ V, P });
      this.tsPath.push({ T, S });
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.phaseProgress += dt * this.animSpeed;
    if (this.phaseProgress >= 1) {
      this.phaseProgress = 0;
      this.cyclePhase = (this.cyclePhase + 1) % 4;
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50);

    const pvWidth = this.showTSDiagram ? width / 2 - 20 : width - 40;
    const pvLeft = 60;
    const pvTop = 60;
    const pvBottom = height - 60;
    const pvHeight = pvBottom - pvTop;

    // Draw PV diagram
    this.renderPVDiagram(pvLeft, pvTop, pvWidth, pvHeight);

    // Draw TS diagram
    if (this.showTSDiagram) {
      const tsLeft = width / 2 + 20;
      const tsWidth = width / 2 - 60;
      this.renderTSDiagram(tsLeft, pvTop, tsWidth, pvHeight);
    }

    // Efficiency display
    const eff = (1 - this.tCold / this.tHot) * 100;
    drawText(ctx, `Carnot Efficiency: \u03B7 = 1 - T_cold/T_hot = ${eff.toFixed(1)}%`,
      width / 2, 25, '#f59e0b', 'bold 14px system-ui', 'center');
    drawText(ctx, `T_hot = ${this.tHot} K  |  T_cold = ${this.tCold} K`,
      width / 2, 45, '#94a3b8', '12px system-ui', 'center');
  }

  private renderPVDiagram(left: number, top: number, w: number, h: number): void {
    const { ctx } = this;

    // Find PV ranges
    let minV = Infinity, maxV = -Infinity, minP = Infinity, maxP = -Infinity;
    for (const pt of this.pvPath) {
      minV = Math.min(minV, pt.V);
      maxV = Math.max(maxV, pt.V);
      minP = Math.min(minP, pt.P);
      maxP = Math.max(maxP, pt.P);
    }
    const padV = (maxV - minV) * 0.15;
    const padP = (maxP - minP) * 0.15;
    minV -= padV; maxV += padV;
    minP -= padP; maxP += padP;

    const mapV = (v: number) => left + ((v - minV) / (maxV - minV)) * w;
    const mapP = (p: number) => top + h - ((p - minP) / (maxP - minP)) * h;

    // Axes
    drawArrow(ctx, left, top + h, left + w + 10, top + h, '#64748b', 1.5, 8);
    drawArrow(ctx, left, top + h, left, top - 10, '#64748b', 1.5, 8);
    drawText(ctx, 'V', left + w + 15, top + h, '#94a3b8', '13px system-ui', 'left');
    drawText(ctx, 'P', left - 5, top - 15, '#94a3b8', '13px system-ui', 'center');
    drawText(ctx, 'PV Diagram', left + w / 2, top - 5, '#e2e8f0', 'bold 12px system-ui', 'center');

    // Fill cycle area with subtle color
    ctx.beginPath();
    for (let i = 0; i < this.pvPath.length; i++) {
      const x = mapV(this.pvPath[i].V);
      const y = mapP(this.pvPath[i].P);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fill();

    // Draw cycle path with process colors
    const steps = 60;
    const processColors = ['#ef4444', '#a855f7', '#3b82f6', '#22c55e'];
    const processNames = ['Isothermal Exp.', 'Adiabatic Exp.', 'Isothermal Comp.', 'Adiabatic Comp.'];

    for (let proc = 0; proc < 4; proc++) {
      const startIdx = proc * steps + (proc > 0 ? proc : 0);
      const endIdx = (proc + 1) * steps + proc;
      ctx.beginPath();
      ctx.strokeStyle = processColors[proc];
      ctx.lineWidth = 2.5;
      for (let i = startIdx; i <= Math.min(endIdx, this.pvPath.length - 1); i++) {
        const x = mapV(this.pvPath[i].V);
        const y = mapP(this.pvPath[i].P);
        if (i === startIdx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Corner points A, B, C, D
    const labels = ['A', 'B', 'C', 'D'];
    const offsets = [[-12, -12], [12, -12], [12, 12], [-12, 12]];
    for (let i = 0; i < 4; i++) {
      const pt = this.points[i];
      const x = mapV(pt.V);
      const y = mapP(pt.P);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = processColors[i];
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawText(ctx, labels[i], x + offsets[i][0], y + offsets[i][1], processColors[i], 'bold 12px system-ui', 'center');
    }

    // Animated dot
    const totalSteps = this.pvPath.length;
    const currentProcessStart = this.cyclePhase * steps + (this.cyclePhase > 0 ? this.cyclePhase : 0);
    const currentIdx = Math.min(
      Math.floor(currentProcessStart + this.phaseProgress * steps),
      totalSteps - 1
    );
    if (currentIdx >= 0 && currentIdx < this.pvPath.length) {
      const dot = this.pvPath[currentIdx];
      const dx = mapV(dot.V);
      const dy = mapP(dot.P);

      // Glow
      const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, 14);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(dx, dy, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dx, dy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Process legend
    const legendY = top + h + 25;
    for (let i = 0; i < 4; i++) {
      const lx = left + (i * w) / 4;
      ctx.fillStyle = processColors[i];
      ctx.fillRect(lx, legendY - 4, 12, 8);
      drawText(ctx, processNames[i], lx + 16, legendY, processColors[i], '9px system-ui', 'left');
    }
  }

  private renderTSDiagram(left: number, top: number, w: number, h: number): void {
    const { ctx } = this;

    // TS ranges
    let minS = Infinity, maxS = -Infinity;
    for (const pt of this.tsPath) {
      minS = Math.min(minS, pt.S);
      maxS = Math.max(maxS, pt.S);
    }
    const padS = (maxS - minS) * 0.15;
    minS -= padS; maxS += padS;
    const minT = Math.min(this.tCold, 100);
    const maxT = this.tHot + 100;

    const mapS = (s: number) => left + ((s - minS) / (maxS - minS)) * w;
    const mapT = (t: number) => top + h - ((t - minT) / (maxT - minT)) * h;

    // Axes
    drawArrow(ctx, left, top + h, left + w + 10, top + h, '#64748b', 1.5, 8);
    drawArrow(ctx, left, top + h, left, top - 10, '#64748b', 1.5, 8);
    drawText(ctx, 'S', left + w + 15, top + h, '#94a3b8', '13px system-ui', 'left');
    drawText(ctx, 'T', left - 5, top - 15, '#94a3b8', '13px system-ui', 'center');
    drawText(ctx, 'TS Diagram', left + w / 2, top - 5, '#e2e8f0', 'bold 12px system-ui', 'center');

    // The TS diagram for a Carnot cycle is a rectangle
    // Fill
    const x1 = mapS(this.points[0].S);
    const x2 = mapS(this.points[1].S);
    const y1 = mapT(this.tHot);
    const y2 = mapT(this.tCold);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    // Rectangle edges
    const processColors = ['#ef4444', '#a855f7', '#3b82f6', '#22c55e'];
    // Top: A->B (isothermal at T_hot)
    ctx.strokeStyle = processColors[0]; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.stroke();
    // Right: B->C (adiabatic, vertical)
    ctx.strokeStyle = processColors[1];
    ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // Bottom: C->D (isothermal at T_cold)
    ctx.strokeStyle = processColors[2];
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y2); ctx.stroke();
    // Left: D->A (adiabatic, vertical)
    ctx.strokeStyle = processColors[3];
    ctx.beginPath(); ctx.moveTo(x1, y2); ctx.lineTo(x1, y1); ctx.stroke();

    // Corner dots
    const labels = ['A', 'B', 'C', 'D'];
    const corners = [
      { x: x1, y: y1 }, { x: x2, y: y1 },
      { x: x2, y: y2 }, { x: x1, y: y2 },
    ];
    const offsets = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(corners[i].x, corners[i].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = processColors[i];
      ctx.fill();
      drawText(ctx, labels[i], corners[i].x + offsets[i][0], corners[i].y + offsets[i][1], processColors[i], 'bold 11px system-ui', 'center');
    }

    // T_hot and T_cold labels
    drawDashedLine(ctx, left, y1, left + w, y1, 'rgba(239,68,68,0.3)', 1, [4, 4]);
    drawDashedLine(ctx, left, y2, left + w, y2, 'rgba(59,130,246,0.3)', 1, [4, 4]);
    drawText(ctx, `T_hot=${this.tHot}K`, left - 5, y1, '#ef4444', '10px monospace', 'right');
    drawText(ctx, `T_cold=${this.tCold}K`, left - 5, y2, '#3b82f6', '10px monospace', 'right');

    // Animated dot on TS
    const steps = 60;
    const totalSteps = this.tsPath.length;
    const currentProcessStart = this.cyclePhase * steps + (this.cyclePhase > 0 ? this.cyclePhase : 0);
    const currentIdx = Math.min(
      Math.floor(currentProcessStart + this.phaseProgress * steps),
      totalSteps - 1
    );
    if (currentIdx >= 0 && currentIdx < this.tsPath.length) {
      const dot = this.tsPath[currentIdx];
      const dx = mapS(dot.S);
      const dy = mapT(dot.T);

      const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, 12);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(dx, dy, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }

    // Q_H and Q_C labels
    const midTopX = (x1 + x2) / 2;
    drawText(ctx, 'Q_H (absorbed)', midTopX, y1 - 12, '#ef4444', '10px system-ui', 'center');
    drawText(ctx, 'Q_C (rejected)', midTopX, y2 + 14, '#3b82f6', '10px system-ui', 'center');
  }

  reset(): void {
    this.cyclePhase = 0;
    this.phaseProgress = 0;
    this.time = 0;
    this.computeCycle();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'tHot', label: 'T (hot reservoir)', min: 400, max: 1000, step: 10, defaultValue: 600, unit: 'K' },
      { type: 'slider', key: 'tCold', label: 'T (cold reservoir)', min: 100, max: 399, step: 5, defaultValue: 300, unit: 'K' },
      { type: 'toggle', key: 'showTSDiagram', label: 'Show TS Diagram', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      tHot: this.tHot,
      tCold: this.tCold,
      showTSDiagram: this.showTSDiagram,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'tHot':
        this.tHot = value as number;
        this.computeCycle();
        break;
      case 'tCold':
        this.tCold = value as number;
        this.computeCycle();
        break;
      case 'showTSDiagram':
        this.showTSDiagram = value as boolean;
        break;
    }
  }
}

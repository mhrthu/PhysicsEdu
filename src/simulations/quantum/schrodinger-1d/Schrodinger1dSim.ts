import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

type PotentialType = 'infinite-well' | 'harmonic' | 'finite-well' | 'step' | 'double-well';

export default class Schrodinger1dSim extends SimulationEngine {
  /* --- controls --- */
  private potentialType: PotentialType = 'infinite-well';
  private potentialParam = 1.0; // well width / spring constant / step height
  private energyLevel = 1;
  private showProbDensity = true;
  private showRealImag = true;

  /* --- computed wavefunction data --- */
  private xArr: number[] = [];
  private psiReal: number[] = [];
  private psiImag: number[] = [];
  private probDensity: number[] = [];
  private potential: number[] = [];
  private energyValue = 0;
  private N = 500;

  /* --- layout --- */
  private plotLeft = 80;
  private plotRight = 0;
  private plotTop = 60;
  private plotBottom = 0;
  private plotW = 0;
  private plotH = 0;

  setup(): void {
    this.recalcLayout();
    this.solve();
  }

  private recalcLayout(): void {
    this.plotRight = this.width - 40;
    this.plotBottom = this.height - 50;
    this.plotW = this.plotRight - this.plotLeft;
    this.plotH = this.plotBottom - this.plotTop;
  }

  /* ============ SOLVE WAVEFUNCTIONS ============ */
  private solve(): void {
    const N = this.N;
    const L = this.potentialParam * 5; // scale
    const dx = (2 * L) / N;
    this.xArr = [];
    this.potential = [];
    this.psiReal = [];
    this.psiImag = [];
    this.probDensity = [];

    for (let i = 0; i < N; i++) {
      this.xArr.push(-L + i * dx);
    }

    // Compute potential
    for (let i = 0; i < N; i++) {
      this.potential.push(this.computePotential(this.xArr[i], L));
    }

    // Solve based on type
    switch (this.potentialType) {
      case 'infinite-well':
        this.solveInfiniteWell(L);
        break;
      case 'harmonic':
        this.solveHarmonic(L);
        break;
      case 'finite-well':
        this.solveFiniteWell(L);
        break;
      case 'step':
        this.solveStep(L);
        break;
      case 'double-well':
        this.solveDoubleWell(L);
        break;
    }

    // Compute probability density
    this.probDensity = this.psiReal.map((r, i) => r * r + this.psiImag[i] * this.psiImag[i]);
  }

  private computePotential(x: number, L: number): number {
    const w = this.potentialParam;
    switch (this.potentialType) {
      case 'infinite-well':
        return (Math.abs(x) > w * 2.5) ? 50 : 0;
      case 'harmonic':
        return 0.5 * w * x * x;
      case 'finite-well':
        return (Math.abs(x) > w * 2.5) ? w * 5 : 0;
      case 'step':
        return x > 0 ? w * 5 : 0;
      case 'double-well':
        return Math.min(w * 5, w * (x * x - w * 2) * (x * x - w * 2) / (w * w * 4));
      default:
        return 0;
    }
  }

  private solveInfiniteWell(L: number): void {
    const n = this.energyLevel;
    const w = this.potentialParam * 2.5;
    const wellL = 2 * w;
    this.energyValue = (n * n * Math.PI * Math.PI) / (2 * wellL * wellL);

    for (let i = 0; i < this.N; i++) {
      const x = this.xArr[i];
      if (Math.abs(x) <= w) {
        const val = Math.sqrt(1 / w) * Math.sin((n * Math.PI * (x + w)) / wellL);
        this.psiReal.push(val);
      } else {
        this.psiReal.push(0);
      }
      this.psiImag.push(0);
    }
  }

  private solveHarmonic(L: number): void {
    const n = this.energyLevel - 1; // n=0,1,2...
    const omega = Math.sqrt(this.potentialParam);
    this.energyValue = omega * (n + 0.5);

    // Hermite-Gauss wavefunctions
    for (let i = 0; i < this.N; i++) {
      const x = this.xArr[i];
      const xi = Math.sqrt(omega) * x;
      const hermite = this.hermite(n, xi);
      const norm = Math.pow(omega / Math.PI, 0.25) / Math.sqrt(Math.pow(2, n) * this.factorial(n));
      const val = norm * hermite * Math.exp(-xi * xi / 2);
      this.psiReal.push(val);
      this.psiImag.push(0);
    }
  }

  private hermite(n: number, x: number): number {
    if (n === 0) return 1;
    if (n === 1) return 2 * x;
    let h0 = 1, h1 = 2 * x;
    for (let k = 2; k <= n; k++) {
      const h2 = 2 * x * h1 - 2 * (k - 1) * h0;
      h0 = h1;
      h1 = h2;
    }
    return h1;
  }

  private factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  private solveFiniteWell(L: number): void {
    // Approximate with shooting method - use analytic for now
    const n = this.energyLevel;
    const w = this.potentialParam * 2.5;
    const V0 = this.potentialParam * 5;
    this.energyValue = Math.min(V0 * 0.95, (n * n * Math.PI * Math.PI) / (2 * (2 * w) * (2 * w)));

    const kappa = Math.sqrt(2 * Math.max(0.001, V0 - this.energyValue));
    const k = Math.sqrt(2 * this.energyValue);

    for (let i = 0; i < this.N; i++) {
      const x = this.xArr[i];
      let val: number;
      if (Math.abs(x) <= w) {
        val = (n % 2 === 1) ? Math.cos(k * x) : Math.sin(k * x);
      } else {
        const boundaryVal = (n % 2 === 1) ? Math.cos(k * w) : Math.sin(k * w);
        val = boundaryVal * Math.exp(-kappa * (Math.abs(x) - w));
      }
      this.psiReal.push(val);
      this.psiImag.push(0);
    }
    this.normalizeWavefunction();
  }

  private solveStep(L: number): void {
    const n = this.energyLevel;
    const V0 = this.potentialParam * 5;
    this.energyValue = V0 * (0.3 + (n - 1) * 0.15);

    const k1 = Math.sqrt(2 * this.energyValue);
    const k2 = this.energyValue > V0 ? Math.sqrt(2 * (this.energyValue - V0)) : 0;
    const kappa = this.energyValue < V0 ? Math.sqrt(2 * (V0 - this.energyValue)) : 0;

    for (let i = 0; i < this.N; i++) {
      const x = this.xArr[i];
      let val: number;
      if (x < 0) {
        val = Math.sin(k1 * x + n * Math.PI / 3);
      } else if (this.energyValue > V0) {
        val = 0.7 * Math.sin(k2 * x + n * Math.PI / 3);
      } else {
        val = Math.exp(-kappa * x);
      }
      this.psiReal.push(val);
      this.psiImag.push(0);
    }
    this.normalizeWavefunction();
  }

  private solveDoubleWell(L: number): void {
    const n = this.energyLevel;
    const w = this.potentialParam;
    const sep = w * Math.sqrt(2);

    this.energyValue = (n * n * Math.PI * Math.PI) / (2 * (4 * w) * (4 * w)) * 0.8;

    for (let i = 0; i < this.N; i++) {
      const x = this.xArr[i];
      const g1 = Math.exp(-(x - sep) * (x - sep) / (w * 0.8));
      const g2 = Math.exp(-(x + sep) * (x + sep) / (w * 0.8));
      let val: number;
      if (n % 2 === 1) {
        val = g1 + g2; // symmetric
      } else {
        val = g1 - g2; // antisymmetric
      }
      // Add oscillations for higher n
      const k = n * Math.PI / (4 * w);
      val *= Math.cos(k * x * 0.5 + (n - 1) * Math.PI / 4);
      this.psiReal.push(val);
      this.psiImag.push(0);
    }
    this.normalizeWavefunction();
  }

  private normalizeWavefunction(): void {
    const dx = (this.xArr[1] - this.xArr[0]);
    let norm2 = 0;
    for (let i = 0; i < this.N; i++) {
      norm2 += this.psiReal[i] * this.psiReal[i] + this.psiImag[i] * this.psiImag[i];
    }
    norm2 *= dx;
    const norm = Math.sqrt(Math.max(1e-10, norm2));
    for (let i = 0; i < this.N; i++) {
      this.psiReal[i] /= norm;
      this.psiImag[i] /= norm;
    }
  }

  /* ============ UPDATE / RENDER ============ */
  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50);
    this.recalcLayout();

    const { plotLeft, plotTop, plotW, plotH, N, xArr, potential, psiReal, psiImag, probDensity } = this;

    if (xArr.length === 0) return;

    const xMin = xArr[0];
    const xMax = xArr[N - 1];

    const toScreenX = (x: number) => plotLeft + ((x - xMin) / (xMax - xMin)) * plotW;
    const mid = plotTop + plotH * 0.5;

    // Find scales
    let maxV = 0;
    for (let i = 0; i < N; i++) maxV = Math.max(maxV, Math.abs(potential[i]));
    maxV = Math.max(maxV, 1);

    let maxPsi = 0;
    for (let i = 0; i < N; i++) {
      maxPsi = Math.max(maxPsi, Math.abs(psiReal[i]), Math.abs(psiImag[i]));
    }
    maxPsi = Math.max(maxPsi, 0.01);

    let maxProb = 0;
    for (let i = 0; i < N; i++) maxProb = Math.max(maxProb, probDensity[i]);
    maxProb = Math.max(maxProb, 0.01);

    const vScale = (plotH * 0.4) / maxV;
    const psiScale = (plotH * 0.35) / maxPsi;
    const probScale = (plotH * 0.35) / maxProb;

    // --- Axes ---
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, mid);
    ctx.lineTo(plotLeft + plotW, mid);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotTop + plotH);
    ctx.stroke();

    // --- Potential V(x) ---
    ctx.beginPath();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let i = 0; i < N; i++) {
      const sx = toScreenX(xArr[i]);
      const sy = mid - Math.min(potential[i], maxV) * vScale;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Fill potential region
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const sx = toScreenX(xArr[i]);
      const sy = mid - Math.min(potential[i], maxV) * vScale;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.lineTo(toScreenX(xArr[N - 1]), mid);
    ctx.lineTo(toScreenX(xArr[0]), mid);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- Energy level line ---
    const ey = mid - (this.energyValue / maxV) * (plotH * 0.4);
    drawDashedLine(ctx, plotLeft, ey, plotLeft + plotW, ey, '#f59e0b', 1.5, [6, 4]);
    drawText(ctx, `E${this.energyLevel} = ${this.energyValue.toFixed(2)}`, plotLeft + plotW + 5, ey, '#f59e0b', '11px monospace', 'left');

    // --- Probability density |psi|^2 ---
    if (this.showProbDensity) {
      ctx.beginPath();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      for (let i = 0; i < N; i++) {
        const sx = toScreenX(xArr[i]);
        const sy = mid - probDensity[i] * probScale;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Fill
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const sx = toScreenX(xArr[i]);
        const sy = mid - probDensity[i] * probScale;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.lineTo(toScreenX(xArr[N - 1]), mid);
      ctx.lineTo(toScreenX(xArr[0]), mid);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // --- Real / Imaginary parts ---
    if (this.showRealImag) {
      // Real
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      for (let i = 0; i < N; i++) {
        const sx = toScreenX(xArr[i]);
        const sy = mid - psiReal[i] * psiScale;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Imaginary
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < N; i++) {
        const sx = toScreenX(xArr[i]);
        const sy = mid - psiImag[i] * psiScale;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // --- Legend ---
    const lx = plotLeft + 10;
    let ly = plotTop + 5;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(lx - 5, ly - 5, 175, this.showProbDensity && this.showRealImag ? 90 : 60);

    drawText(ctx, 'V(x)', lx + 16, ly + 8, '#64748b', '12px monospace', 'left');
    ctx.fillStyle = '#64748b'; ctx.fillRect(lx, ly + 3, 12, 3);
    ly += 18;

    if (this.showRealImag) {
      drawText(ctx, 'Re \u03C8(x)', lx + 16, ly + 8, '#3b82f6', '12px monospace', 'left');
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(lx, ly + 3, 12, 3);
      ly += 18;
      drawText(ctx, 'Im \u03C8(x)', lx + 16, ly + 8, '#ef4444', '12px monospace', 'left');
      ctx.fillStyle = '#ef4444'; ctx.fillRect(lx, ly + 3, 12, 3);
      ly += 18;
    }
    if (this.showProbDensity) {
      drawText(ctx, '|\u03C8(x)|\u00B2', lx + 16, ly + 8, '#22c55e', '12px monospace', 'left');
      ctx.fillStyle = '#22c55e'; ctx.fillRect(lx, ly + 3, 12, 3);
    }

    // --- Title & info ---
    const potNames: Record<PotentialType, string> = {
      'infinite-well': 'Infinite Square Well',
      'harmonic': 'Quantum Harmonic Oscillator',
      'finite-well': 'Finite Square Well',
      'step': 'Step Potential',
      'double-well': 'Double Well',
    };
    drawText(ctx, potNames[this.potentialType], width / 2, 25, '#e2e8f0', 'bold 15px system-ui', 'center');
    drawText(ctx, `n = ${this.energyLevel}`, width / 2, 45, '#94a3b8', '12px monospace', 'center');
    drawText(ctx, 'x', plotLeft + plotW / 2, plotTop + plotH + 25, '#94a3b8', '13px system-ui', 'center');
  }

  reset(): void {
    this.time = 0;
    this.solve();
  }

  resize(w: number, h: number, pr: number): void {
    super.resize(w, h, pr);
    this.recalcLayout();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown', key: 'potentialType', label: 'Potential', defaultValue: 'infinite-well',
        options: [
          { value: 'infinite-well', label: 'Infinite Well' },
          { value: 'harmonic', label: 'Harmonic Oscillator' },
          { value: 'finite-well', label: 'Finite Well' },
          { value: 'step', label: 'Step Potential' },
          { value: 'double-well', label: 'Double Well' },
        ],
      },
      { type: 'slider', key: 'potentialParam', label: 'Potential Parameter', min: 0.2, max: 3, step: 0.1, defaultValue: 1 },
      { type: 'slider', key: 'energyLevel', label: 'Energy Level n', min: 1, max: 10, step: 1, defaultValue: 1 },
      { type: 'toggle', key: 'showProbDensity', label: 'Show |\u03C8|\u00B2', defaultValue: true },
      { type: 'toggle', key: 'showRealImag', label: 'Show Re/Im \u03C8', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      potentialType: this.potentialType,
      potentialParam: this.potentialParam,
      energyLevel: this.energyLevel,
      showProbDensity: this.showProbDensity,
      showRealImag: this.showRealImag,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'potentialType':
        this.potentialType = value as PotentialType;
        this.solve();
        break;
      case 'potentialParam':
        this.potentialParam = value as number;
        this.solve();
        break;
      case 'energyLevel':
        this.energyLevel = value as number;
        this.solve();
        break;
      case 'showProbDensity':
        this.showProbDensity = value as boolean;
        break;
      case 'showRealImag':
        this.showRealImag = value as boolean;
        break;
    }
  }
}

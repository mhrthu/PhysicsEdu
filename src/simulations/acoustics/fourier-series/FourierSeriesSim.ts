import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas } from '@/engine/render/drawUtils.ts';

type WaveformType = 'square' | 'sawtooth' | 'triangle';

export default class FourierSeriesSim extends SimulationEngine {
  private waveform: WaveformType = 'square';
  private harmonics = 5;
  private fundamentalFreq = 2;
  private scrollOffset = 0;

  // Harmonic colors
  private readonly harmonicColors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
    '#06b6d4', '#f97316', '#84cc16', '#e879f9', '#14b8a6',
    '#fb923c', '#38bdf8', '#c084fc', '#4ade80', '#fbbf24',
    '#f472b6', '#2dd4bf', '#818cf8', '#a3e635', '#fb7185',
  ];

  setup(): void {
    this.time = 0;
    this.scrollOffset = 0;
  }

  private getCoefficients(n: number): { a: number; b: number } {
    // Returns Fourier coefficients for harmonic n (1-indexed)
    switch (this.waveform) {
      case 'square':
        // Square wave: b_n = 4/(n*pi) for odd n, 0 for even
        if (n % 2 === 0) return { a: 0, b: 0 };
        return { a: 0, b: 4 / (n * Math.PI) };

      case 'sawtooth':
        // Sawtooth: b_n = -2/(n*pi) * (-1)^n = 2*(-1)^(n+1) / (n*pi)
        return { a: 0, b: 2 * Math.pow(-1, n + 1) / (n * Math.PI) };

      case 'triangle':
        // Triangle wave: a_n = 8/(n^2*pi^2) for odd n (alternating sign), 0 for even
        if (n % 2 === 0) return { a: 0, b: 0 };
        const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
        return { a: 0, b: sign * 8 / (n * n * Math.PI * Math.PI) };

      default:
        return { a: 0, b: 0 };
    }
  }

  private targetWaveform(t: number): number {
    // Evaluate the exact periodic waveform at time t
    const phase = ((t * this.fundamentalFreq) % 1 + 1) % 1; // 0..1
    switch (this.waveform) {
      case 'square':
        return phase < 0.5 ? 1 : -1;
      case 'sawtooth':
        return 2 * phase - 1;
      case 'triangle':
        if (phase < 0.25) return 4 * phase;
        if (phase < 0.75) return 2 - 4 * phase;
        return -4 + 4 * phase;
      default:
        return 0;
    }
  }

  private fourierValue(t: number, maxN: number): number {
    let sum = 0;
    const omega = 2 * Math.PI * this.fundamentalFreq;
    for (let n = 1; n <= maxN; n++) {
      const { a, b } = this.getCoefficients(n);
      sum += a * Math.cos(n * omega * t) + b * Math.sin(n * omega * t);
    }
    return sum;
  }

  private harmonicValue(n: number, t: number): number {
    const omega = 2 * Math.PI * this.fundamentalFreq;
    const { a, b } = this.getCoefficients(n);
    return a * Math.cos(n * omega * t) + b * Math.sin(n * omega * t);
  }

  update(dt: number): void {
    this.time += dt;
    this.scrollOffset += dt * this.fundamentalFreq * 60; // pixels per second scrolling
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    const midY = height * 0.3;
    const bottomY = height * 0.7;
    const amplitude = height * 0.18;
    const harmonicAmp = height * 0.08;
    const margin = 60;

    // Dividing line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, height * 0.5);
    ctx.lineTo(width - margin, height * 0.5);
    ctx.stroke();

    // Top section label
    drawText(ctx, 'Waveform + Fourier Approximation', margin, midY - amplitude - 15, '#e2e8f0', '12px system-ui', 'left');

    // Draw zero lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(margin, midY);
    ctx.lineTo(width - margin, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(margin, bottomY);
    ctx.lineTo(width - margin, bottomY);
    ctx.stroke();
    ctx.setLineDash([]);

    const plotWidth = width - 2 * margin;

    // --- TOP HALF: Target waveform (dashed) + Fourier approximation (solid) ---

    // Target waveform (dashed)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    for (let px = 0; px <= plotWidth; px++) {
      const t = this.time - (plotWidth - px) / (this.fundamentalFreq * 60);
      const val = this.targetWaveform(t);
      const x = margin + px;
      const y = midY - val * amplitude;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Fourier approximation (solid)
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    for (let px = 0; px <= plotWidth; px++) {
      const t = this.time - (plotWidth - px) / (this.fundamentalFreq * 60);
      const val = this.fourierValue(t, this.harmonics);
      const x = margin + px;
      const y = midY - val * amplitude;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- BOTTOM HALF: Individual harmonics ---
    drawText(ctx, 'Individual Harmonics', margin, height * 0.52 + 5, '#e2e8f0', '12px system-ui', 'left');

    // Count active harmonics (those with non-zero coefficients)
    const activeHarmonics: number[] = [];
    for (let n = 1; n <= this.harmonics; n++) {
      const { a, b } = this.getCoefficients(n);
      if (Math.abs(a) > 0.001 || Math.abs(b) > 0.001) {
        activeHarmonics.push(n);
      }
    }

    if (activeHarmonics.length > 0) {
      const spacing = Math.min(harmonicAmp * 2.5, (height * 0.42) / activeHarmonics.length);
      const startY = height * 0.55 + spacing / 2;

      for (let i = 0; i < activeHarmonics.length; i++) {
        const n = activeHarmonics[i];
        const centerY = startY + i * spacing;
        const color = this.harmonicColors[(n - 1) % this.harmonicColors.length];
        const scaleAmp = Math.min(harmonicAmp, spacing * 0.4);

        // Harmonic label
        drawText(ctx, `n=${n}`, margin - 5, centerY, '#64748b', '10px monospace', 'right');

        // Zero line for this harmonic
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, centerY);
        ctx.lineTo(width - margin, centerY);
        ctx.stroke();

        // Draw harmonic
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        for (let px = 0; px <= plotWidth; px++) {
          const t = this.time - (plotWidth - px) / (this.fundamentalFreq * 60);
          const val = this.harmonicValue(n, t);
          const x = margin + px;
          const y = centerY - val * scaleAmp * 3;
          if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Info overlay
    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 280, infoY - 5, 285, 100);

    drawText(ctx, 'Fourier Series', infoX, infoY + 10, '#e2e8f0', 'bold 13px system-ui', 'right');
    drawText(ctx, `Waveform: ${this.waveform}`, infoX, infoY + 30, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Harmonics: N = ${this.harmonics}`, infoX, infoY + 48, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `f\u2080 = ${this.fundamentalFreq} Hz`, infoX, infoY + 66, '#94a3b8', '11px monospace', 'right');

    // Fourier formula for current waveform
    let formula = '';
    switch (this.waveform) {
      case 'square':
        formula = 'b_n = 4/(n\u03C0) for odd n';
        break;
      case 'sawtooth':
        formula = 'b_n = 2(-1)^(n+1)/(n\u03C0)';
        break;
      case 'triangle':
        formula = 'b_n = 8(-1)^k/(n\u00B2\u03C0\u00B2) for odd n';
        break;
    }
    drawText(ctx, formula, infoX, infoY + 84, '#64748b', '11px monospace', 'right');

    // Legend
    drawText(ctx, '\u2500\u2500 target', margin + 5, midY - amplitude - 15, 'rgba(148,163,184,0.5)', '10px system-ui', 'left');
    drawText(ctx, '\u2500\u2500 approx', margin + 80, midY - amplitude - 15, '#3b82f6', '10px system-ui', 'left');
  }

  reset(): void {
    this.time = 0;
    this.scrollOffset = 0;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown',
        key: 'waveform',
        label: 'Waveform',
        options: [
          { value: 'square', label: 'Square' },
          { value: 'sawtooth', label: 'Sawtooth' },
          { value: 'triangle', label: 'Triangle' },
        ],
        defaultValue: 'square',
      },
      { type: 'slider', key: 'harmonics', label: 'Harmonics N', min: 1, max: 20, step: 1, defaultValue: 5 },
      { type: 'slider', key: 'fundamentalFreq', label: 'Fundamental Freq', min: 1, max: 10, step: 1, defaultValue: 2, unit: 'Hz' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      waveform: this.waveform,
      harmonics: this.harmonics,
      fundamentalFreq: this.fundamentalFreq,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'waveform': this.waveform = value as WaveformType; break;
      case 'harmonics': this.harmonics = value as number; break;
      case 'fundamentalFreq': this.fundamentalFreq = value as number; break;
    }
  }
}

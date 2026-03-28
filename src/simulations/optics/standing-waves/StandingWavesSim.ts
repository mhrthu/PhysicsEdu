import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText, drawDashedLine } from '@/engine/render/drawUtils.ts';

export default class StandingWavesSim extends SimulationEngine {
  private harmonic = 1;
  private amplitude = 1;
  private tension = 50;
  private boundary = 'fixed-fixed';
  private linearDensity = 0.01; // kg/m

  private stringStartX = 0;
  private stringEndX = 0;
  private stringY = 0;
  private stringLength = 0;

  setup(): void {
    this.stringStartX = this.width * 0.08;
    this.stringEndX = this.width * 0.92;
    this.stringY = this.height * 0.5;
    this.stringLength = this.stringEndX - this.stringStartX;
  }

  private getWaveSpeed(): number {
    return Math.sqrt(this.tension / this.linearDensity);
  }

  private getWavelength(): number {
    const n = this.harmonic;
    const L = 1; // normalized length in meters
    if (this.boundary === 'fixed-fixed') {
      return (2 * L) / n;
    }
    // fixed-open: lambda = 4L / (2n - 1)
    return (4 * L) / (2 * n - 1);
  }

  private getFrequency(): number {
    return this.getWaveSpeed() / this.getWavelength();
  }

  private getDisplacement(xNorm: number, t: number): number {
    const n = this.harmonic;
    const A = this.amplitude;
    const omega = 2 * Math.PI * this.getFrequency();

    if (this.boundary === 'fixed-fixed') {
      return A * Math.sin(n * Math.PI * xNorm) * Math.cos(omega * t);
    }
    // fixed-open
    return A * Math.sin((2 * n - 1) * Math.PI * xNorm / 2) * Math.cos(omega * t);
  }

  private getEnvelope(xNorm: number): number {
    const n = this.harmonic;
    const A = this.amplitude;
    if (this.boundary === 'fixed-fixed') {
      return A * Math.abs(Math.sin(n * Math.PI * xNorm));
    }
    return A * Math.abs(Math.sin((2 * n - 1) * Math.PI * xNorm / 2));
  }

  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    // Title
    drawText(ctx, 'Standing Waves on a String', width / 2, 24, '#e2e8f0', 'bold 16px system-ui', 'center');

    const sx = this.stringStartX;
    const ex = this.stringEndX;
    const sy = this.stringY;
    const sLen = this.stringLength;
    const ampScale = height * 0.18;

    // Draw equilibrium line
    drawDashedLine(ctx, sx, sy, ex, sy, '#334155', 1, [6, 6]);

    // Draw envelope (dashed)
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 1.5;

    // Upper envelope
    ctx.beginPath();
    for (let px = 0; px <= sLen; px += 2) {
      const xNorm = px / sLen;
      const env = this.getEnvelope(xNorm) * ampScale;
      const x = sx + px;
      const y = sy - env;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Lower envelope
    ctx.beginPath();
    for (let px = 0; px <= sLen; px += 2) {
      const xNorm = px / sLen;
      const env = this.getEnvelope(xNorm) * ampScale;
      const x = sx + px;
      const y = sy + env;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw the wave string
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    for (let px = 0; px <= sLen; px += 2) {
      const xNorm = px / sLen;
      const disp = this.getDisplacement(xNorm, this.time) * ampScale;
      const x = sx + px;
      const y = sy - disp;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw fixed/open boundary markers
    this.drawBoundaries();

    // Find and draw nodes and antinodes
    this.drawNodesAndAntinodes(ampScale);

    // Draw info overlay
    this.drawInfo();
  }

  private drawBoundaries(): void {
    const { ctx } = this;
    const sx = this.stringStartX;
    const ex = this.stringEndX;
    const sy = this.stringY;
    const wallH = 30;

    // Left boundary is always fixed
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(sx - 6, sy - wallH, 6, wallH * 2);

    // Right boundary
    if (this.boundary === 'fixed-fixed') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(ex, sy - wallH, 6, wallH * 2);
    } else {
      // Open end - draw a ring
      ctx.beginPath();
      ctx.arc(ex + 6, sy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      drawText(ctx, 'open', ex + 6, sy + 22, '#64748b', '10px system-ui', 'center');
    }

    drawText(ctx, 'fixed', sx - 3, sy + wallH + 14, '#64748b', '10px system-ui', 'center');
  }

  private drawNodesAndAntinodes(ampScale: number): void {
    const { ctx } = this;
    const sx = this.stringStartX;
    const sy = this.stringY;
    const sLen = this.stringLength;
    const n = this.harmonic;

    // Find nodes (zero displacement points)
    const nodePositions: number[] = [];
    const antinodePositions: number[] = [];

    if (this.boundary === 'fixed-fixed') {
      // Nodes at x = k/n for k = 0, 1, ..., n
      for (let k = 0; k <= n; k++) {
        nodePositions.push(k / n);
      }
      // Antinodes at x = (2k+1)/(2n) for k = 0, ..., n-1
      for (let k = 0; k < n; k++) {
        antinodePositions.push((2 * k + 1) / (2 * n));
      }
    } else {
      // fixed-open: nodes at x = 2k/(2n-1) for k = 0, 1, ...
      const m = 2 * n - 1;
      for (let k = 0; k <= m; k++) {
        const xNorm = (2 * k) / m;
        if (xNorm > 1) break;
        nodePositions.push(xNorm);
      }
      // Antinodes at x = (2k+1)/m
      for (let k = 0; k <= m; k++) {
        const xNorm = (2 * k + 1) / m;
        if (xNorm > 1) break;
        antinodePositions.push(xNorm);
      }
    }

    // Draw nodes as circles
    for (const xNorm of nodePositions) {
      const x = sx + xNorm * sLen;
      ctx.beginPath();
      ctx.arc(x, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw antinodes as different colored circles at max displacement
    for (const xNorm of antinodePositions) {
      const x = sx + xNorm * sLen;
      const disp = this.getDisplacement(xNorm, this.time) * ampScale;
      ctx.beginPath();
      ctx.arc(x, sy - disp, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Legend
    const ly = this.height - 45;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(30, ly, 5, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, `Nodes (${nodePositions.length})`, 42, ly, '#94a3b8', '11px system-ui', 'left');

    ctx.fillStyle = '#22c55e';
    ctx.beginPath(); ctx.arc(160, ly, 5, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, `Antinodes (${antinodePositions.length})`, 172, ly, '#94a3b8', '11px system-ui', 'left');
  }

  private drawInfo(): void {
    const { ctx, width } = this;
    const v = this.getWaveSpeed();
    const f = this.getFrequency();
    const lambda = this.getWavelength();

    const infoX = width - 15;
    const infoY = 50;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const boxW = 230;
    const boxH = 100;
    ctx.fillRect(infoX - boxW, infoY - 5, boxW + 5, boxH);
    ctx.strokeRect(infoX - boxW, infoY - 5, boxW + 5, boxH);

    drawText(ctx, `Harmonic n = ${this.harmonic}`, infoX, infoY + 12, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Frequency f = ${f.toFixed(1)} Hz`, infoX, infoY + 30, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Wavelength \u03BB = ${lambda.toFixed(3)} m`, infoX, infoY + 48, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Wave speed v = ${v.toFixed(1)} m/s`, infoX, infoY + 66, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `v = \u221A(T/\u03BC) = \u221A(${this.tension}/${this.linearDensity})`, infoX, infoY + 84, '#64748b', '10px monospace', 'right');
  }

  reset(): void {
    this.time = 0;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.stringStartX = this.width * 0.08;
    this.stringEndX = this.width * 0.92;
    this.stringY = this.height * 0.5;
    this.stringLength = this.stringEndX - this.stringStartX;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'harmonic', label: 'Harmonic (n)', min: 1, max: 8, step: 1, defaultValue: 1 },
      { type: 'slider', key: 'amplitude', label: 'Amplitude', min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
      { type: 'slider', key: 'tension', label: 'Tension (T)', min: 10, max: 200, step: 5, defaultValue: 50, unit: 'N' },
      {
        type: 'dropdown', key: 'boundary', label: 'Boundary Conditions',
        options: [
          { value: 'fixed-fixed', label: 'Fixed-Fixed' },
          { value: 'fixed-open', label: 'Fixed-Open' },
        ],
        defaultValue: 'fixed-fixed',
      },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      harmonic: this.harmonic,
      amplitude: this.amplitude,
      tension: this.tension,
      boundary: this.boundary,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'harmonic': this.harmonic = value as number; break;
      case 'amplitude': this.amplitude = value as number; break;
      case 'tension': this.tension = value as number; break;
      case 'boundary': this.boundary = value as string; break;
    }
  }
}

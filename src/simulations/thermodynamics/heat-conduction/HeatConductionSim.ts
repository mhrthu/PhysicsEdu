import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawText, clearCanvas } from '@/engine/render/drawUtils.ts';

export default class HeatConductionSim extends SimulationEngine {
  private conductivity = 2.0;
  private sourceTemp = 450;
  private showIsotherms = false;
  private showFluxVectors = false;
  private placingCold = false;

  private cols = 0;
  private rows = 0;
  private cellSize = 8;
  private temp!: Float32Array;
  private tempNext!: Float32Array;
  // sourceGrid: NaN = free, otherwise pinned temperature
  private sourceGrid!: Float32Array;
  private imageData!: ImageData;

  private ox = 0;
  private oy = 0;
  private pointerDown = false;

  setup(): void {
    this.cellSize = Math.max(6, Math.floor(Math.min(this.width, this.height) / 80));
    this.cols = Math.floor((this.width - 60) / this.cellSize);
    this.rows = Math.floor((this.height - 60) / this.cellSize);
    this.ox = Math.floor((this.width - this.cols * this.cellSize) / 2);
    this.oy = Math.floor((this.height - this.rows * this.cellSize) / 2);
    const n = this.cols * this.rows;
    this.temp = new Float32Array(n).fill(293);
    this.tempNext = new Float32Array(n).fill(293);
    this.sourceGrid = new Float32Array(n).fill(NaN);
    this.imageData = new ImageData(this.cols, this.rows);
  }

  private idx(x: number, y: number) { return y * this.cols + x; }

  update(dt: number): void {
    this.time += dt;
    const cols = this.cols, rows = this.rows;

    // Clamp alpha for unconditional stability: alpha <= 0.24
    const alpha = Math.min(0.24, this.conductivity * 0.08);

    // Apply pinned sources
    for (let i = 0; i < this.sourceGrid.length; i++) {
      if (!isNaN(this.sourceGrid[i])) this.temp[i] = this.sourceGrid[i];
    }

    // Run multiple substeps per frame for speed
    const substeps = 4;
    for (let s = 0; s < substeps; s++) {
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const c = this.idx(x, y);
          if (!isNaN(this.sourceGrid[c])) { this.tempNext[c] = this.sourceGrid[c]; continue; }
          const lap =
            this.temp[c + 1] + this.temp[c - 1] +
            this.temp[c + cols] + this.temp[c - cols] -
            4 * this.temp[c];
          this.tempNext[c] = this.temp[c] + alpha * lap;
        }
      }
      // Neumann boundary
      for (let x = 0; x < cols; x++) {
        this.tempNext[this.idx(x, 0)] = this.tempNext[this.idx(x, 1)];
        this.tempNext[this.idx(x, rows - 1)] = this.tempNext[this.idx(x, rows - 2)];
      }
      for (let y = 0; y < rows; y++) {
        this.tempNext[this.idx(0, y)] = this.tempNext[this.idx(1, y)];
        this.tempNext[this.idx(cols - 1, y)] = this.tempNext[this.idx(cols - 2, y)];
      }
      // Swap
      const tmp = this.temp; this.temp = this.tempNext; this.tempNext = tmp;
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#09090b');

    const cols = this.cols, rows = this.rows;
    const cs = this.cellSize;
    const data = this.imageData.data;

    // Fill ImageData
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = this.temp[this.idx(x, y)];
        const [r, g, b] = this.tempToRGB(t);
        const base = (y * cols + x) * 4;
        data[base] = r; data[base + 1] = g; data[base + 2] = b; data[base + 3] = 255;
      }
    }

    // Draw scaled to canvas
    const offscreen = new OffscreenCanvas(cols, rows);
    const octx = offscreen.getContext('2d')!;
    octx.putImageData(this.imageData, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, this.ox, this.oy, cols * cs, rows * cs);
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.ox, this.oy, cols * cs, rows * cs);

    // Isotherms
    if (this.showIsotherms) this.renderIsotherms();

    // Flux vectors
    if (this.showFluxVectors) this.renderFluxVectors();

    // Source markers
    for (let i = 0; i < this.sourceGrid.length; i++) {
      if (isNaN(this.sourceGrid[i])) continue;
      const x = i % cols, y = Math.floor(i / cols);
      const sx = this.ox + x * cs + cs / 2, sy = this.oy + y * cs + cs / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, cs * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = this.sourceGrid[i] > 293 ? 'rgba(251,191,36,0.8)' : 'rgba(56,189,248,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Color bar
    this.renderColorBar();

    // Labels
    drawText(ctx, '∂T/∂t = α∇²T', width / 2, 20, 'rgba(255,255,255,0.5)', '13px system-ui', 'center');
    const modeText = this.placingCold ? '❄ Cold sink mode' : '🔥 Hot source mode';
    drawText(ctx, modeText, width / 2, height - 14, this.placingCold ? '#38bdf8' : '#fbbf24', '11px system-ui', 'center');
  }

  private tempToRGB(t: number): [number, number, number] {
    const minT = 100, maxT = 600;
    const n = Math.max(0, Math.min(1, (t - minT) / (maxT - minT)));
    // Colormap: black → dark blue → cyan → green → yellow → orange → white
    if (n < 0.2) {
      const s = n / 0.2;
      return [0, Math.round(s * 50), Math.round(s * 180)];
    } else if (n < 0.4) {
      const s = (n - 0.2) / 0.2;
      return [0, Math.round(50 + s * 180), Math.round(180 + s * 75)];
    } else if (n < 0.6) {
      const s = (n - 0.4) / 0.2;
      return [Math.round(s * 230), 230, Math.round(255 - s * 255)];
    } else if (n < 0.8) {
      const s = (n - 0.6) / 0.2;
      return [230, Math.round(230 - s * 100), 0];
    } else {
      const s = (n - 0.8) / 0.2;
      return [255, Math.round(130 + s * 125), Math.round(s * 255)];
    }
  }

  private renderIsotherms(): void {
    const { ctx } = this;
    const cols = this.cols, rows = this.rows, cs = this.cellSize;
    const levels = [150, 200, 250, 300, 350, 400, 450, 500, 550];
    for (const level of levels) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const tl = this.temp[this.idx(x, y)], tr = this.temp[this.idx(x + 1, y)];
          const bl = this.temp[this.idx(x, y + 1)];
          if ((tl - level) * (tr - level) < 0) {
            const f = (level - tl) / (tr - tl);
            const px = this.ox + (x + f) * cs, py = this.oy + (y + 0.5) * cs;
            ctx.moveTo(px - 1, py); ctx.lineTo(px + 1, py);
          }
          if ((tl - level) * (bl - level) < 0) {
            const f = (level - tl) / (bl - tl);
            const px = this.ox + (x + 0.5) * cs, py = this.oy + (y + f) * cs;
            ctx.moveTo(px, py - 1); ctx.lineTo(px, py + 1);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private renderFluxVectors(): void {
    const { ctx } = this;
    const cols = this.cols, rows = this.rows, cs = this.cellSize;
    const step = Math.max(5, Math.floor(cols / 16));
    for (let y = step; y < rows - step; y += step) {
      for (let x = step; x < cols - step; x += step) {
        const dTdx = (this.temp[this.idx(x + 1, y)] - this.temp[this.idx(x - 1, y)]) / 2;
        const dTdy = (this.temp[this.idx(x, y + 1)] - this.temp[this.idx(x, y - 1)]) / 2;
        const qx = -dTdx, qy = -dTdy;
        const mag = Math.sqrt(qx * qx + qy * qy);
        if (mag < 1) continue;
        const scale = Math.min(step * cs * 0.45, Math.log(mag + 1) * 3);
        const nx = qx / mag, ny = qy / mag;
        const sx = this.ox + x * cs + cs / 2, sy = this.oy + y * cs + cs / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + nx * scale, sy + ny * scale);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderColorBar(): void {
    const { ctx, width } = this;
    const barH = this.rows * this.cellSize;
    const barX = this.ox + this.cols * this.cellSize + 8;
    const barY = this.oy;
    const barW = 12;
    for (let i = 0; i < barH; i++) {
      const t = 600 - (i / barH) * 500;
      const [r, g, b] = this.tempToRGB(t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(barX, barY + i, barW, 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    drawText(ctx, '600K', barX + barW + 4, barY + 6, 'rgba(255,255,255,0.4)', '9px monospace', 'left');
    drawText(ctx, '350K', barX + barW + 4, barY + barH / 2, 'rgba(255,255,255,0.4)', '9px monospace', 'left');
    drawText(ctx, '100K', barX + barW + 4, barY + barH - 4, 'rgba(255,255,255,0.4)', '9px monospace', 'left');
    if (barX + barW + 30 > width) {
      // fallback: draw on left side
    }
  }

  private screenToGrid(x: number, y: number): { gx: number; gy: number } | null {
    const gx = Math.floor((x - this.ox) / this.cellSize);
    const gy = Math.floor((y - this.oy) / this.cellSize);
    if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) return { gx, gy };
    return null;
  }

  private paintSource(x: number, y: number): void {
    const g = this.screenToGrid(x, y);
    if (!g) return;
    const radius = 3;
    const t = this.placingCold ? Math.max(100, 293 - (this.sourceTemp - 293)) : this.sourceTemp;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const gx = g.gx + dx, gy = g.gy + dy;
        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) continue;
        this.sourceGrid[this.idx(gx, gy)] = t;
        this.temp[this.idx(gx, gy)] = t;
      }
    }
  }

  reset(): void {
    this.temp.fill(293);
    this.tempNext.fill(293);
    this.sourceGrid.fill(NaN);
    this.time = 0;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.setup();
  }

  onPointerDown(x: number, y: number): void {
    this.pointerDown = true;
    this.paintSource(x, y);
  }
  onPointerMove(x: number, y: number): void {
    if (this.pointerDown) this.paintSource(x, y);
  }
  onPointerUp(_x: number, _y: number): void { this.pointerDown = false; }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'conductivity', label: 'Thermal Conductivity', min: 0.1, max: 10, step: 0.1, defaultValue: 2.0, unit: 'α' },
      { type: 'slider', key: 'sourceTemp', label: 'Source Temperature', min: 300, max: 600, step: 10, defaultValue: 450, unit: 'K' },
      { type: 'toggle', key: 'placingCold', label: '❄ Cold Sink Mode', defaultValue: false },
      { type: 'toggle', key: 'showIsotherms', label: 'Isotherms', defaultValue: false },
      { type: 'toggle', key: 'showFluxVectors', label: 'Heat Flux Vectors', defaultValue: false },
      { type: 'button', key: 'clearSources', label: 'Clear All Sources' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      conductivity: this.conductivity,
      sourceTemp: this.sourceTemp,
      placingCold: this.placingCold,
      showIsotherms: this.showIsotherms,
      showFluxVectors: this.showFluxVectors,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'conductivity': this.conductivity = value as number; break;
      case 'sourceTemp': this.sourceTemp = value as number; break;
      case 'placingCold': this.placingCold = value as boolean; break;
      case 'showIsotherms': this.showIsotherms = value as boolean; break;
      case 'showFluxVectors': this.showFluxVectors = value as boolean; break;
      case 'clearSources':
        this.sourceGrid.fill(NaN);
        this.temp.fill(293);
        this.tempNext.fill(293);
        break;
    }
  }
}

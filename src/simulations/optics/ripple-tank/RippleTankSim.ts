import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawText } from '@/engine/render/drawUtils.ts';

// ── Wave source ───────────────────────────────────────────────────────────────

interface WaveSource {
  x: number;
  y: number;
  id: number;
}

// ── Color mapping ─────────────────────────────────────────────────────────────

/**
 * Map displacement in [-1, 1] to RGBA.
 * Negative = deep blue, zero = dark gray, positive = bright cyan/white.
 */
function displacementToColor(d: number, alpha = 255): [number, number, number, number] {
  // clamp
  const v = Math.max(-1, Math.min(1, d));
  if (v >= 0) {
    // 0 → dark teal (#0d2030), 0.5 → cyan (#22d3ee), 1 → near-white (#e0f7ff)
    const t = v;
    const r = Math.round(13 + t * (224 - 13));
    const g = Math.round(32 + t * (247 - 32));
    const b = Math.round(48 + t * (255 - 48));
    return [r, g, b, alpha];
  } else {
    // 0 → dark teal, -1 → deep navy (#020c1b)
    const t = -v;
    const r = Math.round(13 - t * 11);
    const g = Math.round(32 - t * 26);
    const b = Math.round(48 + t * (80 - 48));
    return [Math.max(0, r), Math.max(0, g), b, alpha];
  }
}

// ── Main Simulation ───────────────────────────────────────────────────────────

let _sourceIdCounter = 0;

export default class RippleTankSim extends SimulationEngine {
  private wavelength = 60;    // pixels
  private frequency = 1.5;    // Hz
  private amplitude = 1.0;
  private damping = 0.4;      // 0 = none, 1 = strong
  private showNodalLines = false;
  private showSources = true;

  private sources: WaveSource[] = [];

  // Drag state
  private draggingSource: WaveSource | null = null;
  private dragOffX = 0;
  private dragOffY = 0;

  // ImageData for fast pixel rendering
  private imageData: ImageData | null = null;

  // Offscreen canvas for wave field
  private offscreen: OffscreenCanvas | null = null;
  private offCtx: OffscreenCanvasRenderingContext2D | null = null;

  setup(): void {
    this.sources = [
      { x: this.width * 0.38, y: this.height * 0.5, id: _sourceIdCounter++ },
      { x: this.width * 0.62, y: this.height * 0.5, id: _sourceIdCounter++ },
    ];
    this.allocImageData();
  }

  private allocImageData(): void {
    if (this.width <= 0 || this.height <= 0) return;
    this.imageData = new ImageData(this.width, this.height);

    // Offscreen canvas for nodal line overlay
    if (typeof OffscreenCanvas !== 'undefined') {
      this.offscreen = new OffscreenCanvas(this.width, this.height);
      this.offCtx = this.offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D;
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.allocImageData();
  }

  reset(): void {
    this.wavelength = 60;
    this.frequency = 1.5;
    this.amplitude = 1.0;
    this.damping = 0.4;
    this.showNodalLines = false;
    this.showSources = true;
    this.sources = [
      { x: this.width * 0.38, y: this.height * 0.5, id: _sourceIdCounter++ },
      { x: this.width * 0.62, y: this.height * 0.5, id: _sourceIdCounter++ },
    ];
    this.time = 0;
    this.draggingSource = null;
  }

  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height, time } = this;
    if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
      this.allocImageData();
    }
    if (!this.imageData) return;

    const data = this.imageData.data;
    const k = (2 * Math.PI) / this.wavelength;
    const omega = 2 * Math.PI * this.frequency;
    const amp = this.amplitude;
    const dampStr = this.damping;
    const numSrc = this.sources.length;
    const t = time;

    // Pixel step for performance (2x2 blocks)
    const step = 2;

    for (let py = 0; py < height; py += step) {
      for (let px = 0; px < width; px += step) {
        let total = 0;

        for (let si = 0; si < numSrc; si++) {
          const src = this.sources[si];
          const dx = px - src.x;
          const dy = py - src.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r < 0.5) continue;

          // Amplitude with optional damping: A / r^damping
          const a = dampStr > 0 ? amp / Math.pow(Math.max(r, 1), dampStr * 0.5) : amp;
          total += a * Math.sin(k * r - omega * t);
        }

        // Normalize: max possible is numSrc * amp
        const maxVal = Math.max(numSrc * amp, 1);
        const norm = Math.max(-1, Math.min(1, total / maxVal));

        const [r, g, b, a] = displacementToColor(norm);

        // Fill 2x2 block
        for (let dy = 0; dy < step && py + dy < height; dy++) {
          for (let dx = 0; dx < step && px + dx < width; dx++) {
            const idx = ((py + dy) * width + (px + dx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
          }
        }
      }
    }

    // putImageData ignores canvas transform (DPR scale), so use offscreen + drawImage
    if (!this.offscreen || this.offscreen.width !== width || this.offscreen.height !== height) {
      this.offscreen = new OffscreenCanvas(width, height);
      this.offCtx = this.offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D;
    }
    this.offCtx!.putImageData(this.imageData, 0, 0);
    ctx.drawImage(this.offscreen!, 0, 0, width, height);

    // Nodal lines overlay (only meaningful for >= 2 sources)
    if (this.showNodalLines && this.sources.length >= 2) {
      this.drawNodalLines();
    }

    // Draw sources
    if (this.showSources) {
      this.drawSources();
    }

    // Info panel
    this.drawInfoPanel();
  }

  private drawNodalLines(): void {
    const { ctx, width, height, time } = this;
    const k = (2 * Math.PI) / this.wavelength;
    const omega = 2 * Math.PI * this.frequency;
    const amp = this.amplitude;
    const dampStr = this.damping;
    const numSrc = this.sources.length;

    ctx.save();
    ctx.globalAlpha = 0.35;

    const step = 3;
    for (let py = 0; py < height; py += step) {
      for (let px = 0; px < width; px += step) {
        let total = 0;
        for (let si = 0; si < numSrc; si++) {
          const src = this.sources[si];
          const dx = px - src.x;
          const dy = py - src.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r < 0.5) continue;
          const a = dampStr > 0 ? amp / Math.pow(Math.max(r, 1), dampStr * 0.5) : amp;
          total += a * Math.sin(k * r - omega * time);
        }
        const maxVal = Math.max(numSrc * amp, 1);
        const norm = total / maxVal;

        // Draw a small white pixel near zero crossings
        if (Math.abs(norm) < 0.08) {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(px, py, step, step);
        }
      }
    }
    ctx.restore();
  }

  private drawSources(): void {
    const { ctx, time } = this;
    const omega = 2 * Math.PI * this.frequency;

    for (const src of this.sources) {
      const pulse = 0.5 + 0.5 * Math.sin(omega * time);

      // Ripple rings
      for (let ring = 1; ring <= 3; ring++) {
        const ringPhase = (time * this.frequency - ring * 0.3) % 1;
        if (ringPhase < 0) continue;
        const ringR = ringPhase * this.wavelength * 0.8;
        const ringAlpha = (1 - ringPhase) * 0.4;
        ctx.beginPath();
        ctx.arc(src.x, src.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34,211,238,${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Glow
      const glowR = 10 + pulse * 4;
      const glow = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, glowR);
      glow.addColorStop(0, `rgba(34,211,238,${0.6 + pulse * 0.3})`);
      glow.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.beginPath();
      ctx.arc(src.x, src.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(src.x, src.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private drawInfoPanel(): void {
    const { ctx, width, height } = this;

    ctx.fillStyle = 'rgba(9,9,11,0.82)';
    ctx.fillRect(10, 10, 210, 88);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 210, 88);

    drawText(ctx, 'Ripple Tank', 20, 27, '#e2e8f0', 'bold 12px system-ui');
    drawText(ctx, `λ = ${this.wavelength} px  f = ${this.frequency.toFixed(1)} Hz`, 20, 46, '#94a3b8', '11px monospace');
    drawText(ctx, `Sources: ${this.sources.length}`, 20, 62, '#94a3b8', '11px monospace');
    drawText(ctx, `ψ = A·sin(kr - ωt) / r^d`, 20, 78, '#22d3ee', '10px monospace');
    drawText(ctx, 'Drag sources  ·  Add via control', width / 2, height - 14, '#475569', '11px system-ui', 'center');
  }

  // ── Pointer ──────────────────────────────────────────────────────────────────

  onPointerDown(x: number, y: number): void {
    for (const src of this.sources) {
      const dx = x - src.x, dy = y - src.y;
      if (dx * dx + dy * dy < 400) {
        this.draggingSource = src;
        this.dragOffX = dx;
        this.dragOffY = dy;
        return;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.draggingSource) {
      this.draggingSource.x = Math.max(0, Math.min(this.width, x - this.dragOffX));
      this.draggingSource.y = Math.max(0, Math.min(this.height, y - this.dragOffY));
    }
  }

  onPointerUp(_x: number, _y: number): void {
    this.draggingSource = null;
  }

  // ── Controls ─────────────────────────────────────────────────────────────────

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'wavelength', label: 'Wavelength (λ)', min: 20, max: 120, step: 2, defaultValue: 60, unit: 'px' },
      { type: 'slider', key: 'frequency', label: 'Frequency', min: 0.5, max: 5, step: 0.1, defaultValue: 1.5, unit: 'Hz' },
      { type: 'slider', key: 'amplitude', label: 'Amplitude', min: 0.5, max: 2, step: 0.1, defaultValue: 1.0 },
      { type: 'slider', key: 'damping', label: 'Damping', min: 0, max: 1, step: 0.05, defaultValue: 0.4 },
      { type: 'toggle', key: 'showNodalLines', label: 'Show Nodal Lines', defaultValue: false },
      { type: 'toggle', key: 'showSources', label: 'Show Sources', defaultValue: true },
      { type: 'button', key: 'addSource', label: 'Add Source' },
      { type: 'button', key: 'clearSources', label: 'Clear Sources' },
      { type: 'button', key: 'reset', label: 'Reset' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      wavelength: this.wavelength,
      frequency: this.frequency,
      amplitude: this.amplitude,
      damping: this.damping,
      showNodalLines: this.showNodalLines,
      showSources: this.showSources,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'wavelength': this.wavelength = value as number; break;
      case 'frequency': this.frequency = value as number; break;
      case 'amplitude': this.amplitude = value as number; break;
      case 'damping': this.damping = value as number; break;
      case 'showNodalLines': this.showNodalLines = value as boolean; break;
      case 'showSources': this.showSources = value as boolean; break;
      case 'addSource':
        this.sources.push({
          x: this.width / 2 + (Math.random() - 0.5) * 100,
          y: this.height / 2 + (Math.random() - 0.5) * 100,
          id: _sourceIdCounter++,
        });
        break;
      case 'clearSources':
        this.sources = [];
        break;
      case 'reset':
        this.reset();
        break;
    }
  }
}

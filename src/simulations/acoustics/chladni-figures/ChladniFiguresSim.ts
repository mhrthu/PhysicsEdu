import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas } from '@/engine/render/drawUtils.ts';

interface Particle {
  x: number;  // 0..1 normalized position on plate
  y: number;
}

export default class ChladniFiguresSim extends SimulationEngine {
  private modeM = 2;
  private modeN = 3;
  private showParticles = true;
  private showDisplacement = true;

  private particles: Particle[] = [];
  private plateSize = 0;
  private plateX = 0;
  private plateY = 0;
  private particleCount = 2000;

  setup(): void {
    this.computeLayout();
    this.initParticles();
    this.time = 0;
  }

  private computeLayout(): void {
    const margin = 80;
    this.plateSize = Math.min(this.width - margin * 2, this.height - margin * 2);
    this.plateX = (this.width - this.plateSize) / 2;
    this.plateY = (this.height - this.plateSize) / 2;
  }

  private initParticles(): void {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
      });
    }
  }

  private displacement(nx: number, ny: number, t: number): number {
    const m = this.modeM;
    const n = this.modeN;
    const omega = Math.PI * Math.sqrt(m * m + n * n);
    return Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny) * Math.cos(omega * t);
  }

  private displacementAmplitude(nx: number, ny: number): number {
    // Time-independent amplitude
    const m = this.modeM;
    const n = this.modeN;
    return Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny);
  }

  update(dt: number): void {
    this.time += dt;

    // Drift particles toward nodal lines (where amplitude ~= 0)
    const step = 0.003;
    const m = this.modeM;
    const n = this.modeN;

    for (const p of this.particles) {
      const amp = Math.abs(this.displacementAmplitude(p.x, p.y));

      if (amp > 0.02) {
        // Compute gradient of |amplitude| to move downhill toward nodal lines
        const eps = 0.005;
        const ax = Math.abs(this.displacementAmplitude(p.x + eps, p.y));
        const bx = Math.abs(this.displacementAmplitude(p.x - eps, p.y));
        const ay = Math.abs(this.displacementAmplitude(p.x, p.y + eps));
        const by = Math.abs(this.displacementAmplitude(p.x, p.y - eps));

        const gx = (ax - bx) / (2 * eps);
        const gy = (ay - by) / (2 * eps);
        const glen = Math.sqrt(gx * gx + gy * gy);

        if (glen > 0.001) {
          p.x -= step * (gx / glen) * amp;
          p.y -= step * (gy / glen) * amp;
        }

        // Add slight jitter
        p.x += (Math.random() - 0.5) * 0.001;
        p.y += (Math.random() - 0.5) * 0.001;
      }

      // Clamp to plate
      p.x = Math.max(0, Math.min(1, p.x));
      p.y = Math.max(0, Math.min(1, p.y));
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    const px = this.plateX;
    const py = this.plateY;
    const ps = this.plateSize;

    // Draw plate with displacement color
    if (this.showDisplacement) {
      const resolution = 4; // pixels per sample
      for (let ix = 0; ix < ps; ix += resolution) {
        for (let iy = 0; iy < ps; iy += resolution) {
          const nx = ix / ps;
          const ny = iy / ps;
          const z = this.displacement(nx, ny, this.time);

          // Blue negative, white zero, orange positive
          let r: number, g: number, b: number;
          if (z > 0) {
            const t = Math.min(1, z);
            r = Math.round(255 * (0.15 + 0.85 * t));
            g = Math.round(255 * (0.15 + 0.45 * t));
            b = Math.round(255 * (0.15 + 0.05 * t));
          } else {
            const t = Math.min(1, -z);
            r = Math.round(255 * (0.15 - 0.05 * t));
            g = Math.round(255 * (0.15 + 0.25 * t));
            b = Math.round(255 * (0.15 + 0.85 * t));
          }

          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(px + ix, py + iy, resolution, resolution);
        }
      }
    } else {
      // Plain dark plate
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(px, py, ps, ps);
    }

    // Plate border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, ps, ps);

    // Draw particles (sand)
    if (this.showParticles) {
      ctx.fillStyle = '#fde68a';
      for (const p of this.particles) {
        const cx = px + p.x * ps;
        const cy = py + p.y * ps;
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }

    // Info overlay
    const m = this.modeM;
    const n = this.modeN;
    const L = 1; // normalized
    const c = 100; // arbitrary wave speed for display
    const fmn = (c / (2 * L)) * Math.sqrt(m * m + n * n);

    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 220, infoY - 5, 225, 80);

    drawText(ctx, 'Chladni Figures', infoX, infoY + 10, '#e2e8f0', 'bold 13px system-ui', 'right');
    drawText(ctx, `Mode: (${m}, ${n})`, infoX, infoY + 30, '#94a3b8', '12px monospace', 'right');
    drawText(ctx, `f_mn \u221D ${Math.sqrt(m * m + n * n).toFixed(2)}`, infoX, infoY + 48, '#94a3b8', '12px monospace', 'right');
    drawText(ctx, `Time: ${this.time.toFixed(2)} s`, infoX, infoY + 66, '#94a3b8', '11px monospace', 'right');

    // Formula at bottom
    drawText(ctx, 'z(x,y,t) = cos(m\u03C0x/L)\u00B7cos(n\u03C0y/L)\u00B7cos(\u03C9t)', width / 2, height - 20, '#64748b', '12px monospace', 'center');
  }

  reset(): void {
    this.initParticles();
    this.time = 0;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.computeLayout();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'modeM', label: 'Mode m', min: 0.5, max: 8, step: 0.1, defaultValue: 2 },
      { type: 'slider', key: 'modeN', label: 'Mode n', min: 0.5, max: 8, step: 0.1, defaultValue: 3 },
      { type: 'toggle', key: 'showParticles', label: 'Show Particles', defaultValue: true },
      { type: 'toggle', key: 'showDisplacement', label: 'Show Displacement Color', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      modeM: this.modeM,
      modeN: this.modeN,
      showParticles: this.showParticles,
      showDisplacement: this.showDisplacement,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'modeM':
        this.modeM = value as number;
        this.initParticles();
        break;
      case 'modeN':
        this.modeN = value as number;
        this.initParticles();
        break;
      case 'showParticles':
        this.showParticles = value as boolean;
        break;
      case 'showDisplacement':
        this.showDisplacement = value as boolean;
        break;
    }
  }
}

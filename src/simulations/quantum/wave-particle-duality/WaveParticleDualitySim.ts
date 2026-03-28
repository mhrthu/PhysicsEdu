import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  targetY: number;
  active: boolean;
}

interface Hit {
  y: number;
  age: number;
}

export default class WaveParticleDualitySim extends SimulationEngine {
  /* --- controls --- */
  private slitWidth = 2;
  private slitSeparation = 8;
  private wavelength = 4;
  private showWaveOverlay = false;
  private continuousMode = false;

  /* --- state --- */
  private particles: Particle[] = [];
  private hits: Hit[] = [];
  private histogram: number[] = [];
  private histogramBins = 200;
  private fireTimer = 0;
  private fireInterval = 0.05;

  /* --- layout --- */
  private sourceX = 0;
  private slitX = 0;
  private screenX = 0;

  setup(): void {
    this.histogram = new Array(this.histogramBins).fill(0);
    this.recalcLayout();
  }

  private recalcLayout(): void {
    this.sourceX = 60;
    this.slitX = this.width * 0.35;
    this.screenX = this.width - 80;
  }

  /* ------------ interference probability ------------ */
  private interferenceProb(y: number): number {
    const h = this.height;
    const dy = y - h / 2;
    const L = this.screenX - this.slitX;
    const d = this.slitSeparation;
    const a = this.slitWidth;
    const lam = this.wavelength;

    // Double-slit intensity: cos^2(pi*d*y/(lam*L)) * sinc^2(pi*a*y/(lam*L))
    const argDouble = (Math.PI * d * dy) / (lam * L);
    const argSingle = (Math.PI * a * dy) / (lam * L);
    const cosine = Math.cos(argDouble);
    const sinc = argSingle === 0 ? 1 : Math.sin(argSingle) / argSingle;
    return cosine * cosine * sinc * sinc;
  }

  private sampleDetectionY(): number {
    // Rejection sampling from the interference distribution
    const h = this.height;
    const margin = 30;
    for (let attempt = 0; attempt < 500; attempt++) {
      const y = margin + Math.random() * (h - 2 * margin);
      const p = this.interferenceProb(y);
      if (Math.random() < p) return y;
    }
    return h / 2;
  }

  private fireParticle(): void {
    const targetY = this.sampleDetectionY();
    const speed = 600;
    const dx = this.screenX - this.sourceX;
    const dy = targetY - this.height / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.particles.push({
      x: this.sourceX,
      y: this.height / 2,
      vx: speed,
      targetY,
      active: true,
    });
  }

  update(dt: number): void {
    this.time += dt;

    // Fire particles
    if (this.continuousMode) {
      this.fireTimer += dt;
      while (this.fireTimer >= this.fireInterval) {
        this.fireTimer -= this.fireInterval;
        this.fireParticle();
      }
    }

    // Move particles
    for (const p of this.particles) {
      if (!p.active) continue;
      const progress = (p.x - this.sourceX) / (this.screenX - this.sourceX);
      const currentTargetY = this.height / 2 + (p.targetY - this.height / 2) * progress;
      const dy = currentTargetY - p.y;
      p.x += p.vx * dt;
      p.y += dy * 5 * dt;

      if (p.x >= this.screenX) {
        p.active = false;
        const hitY = p.targetY;
        this.hits.push({ y: hitY, age: 0 });
        // Update histogram
        const bin = Math.floor(((hitY) / this.height) * this.histogramBins);
        if (bin >= 0 && bin < this.histogramBins) {
          this.histogram[bin]++;
        }
      }
    }

    // Age hits
    for (const h of this.hits) {
      h.age += dt;
    }

    // Remove dead particles
    this.particles = this.particles.filter((p) => p.active);
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50);

    // --- Barrier with slits ---
    const barrierW = 6;
    const cy = height / 2;
    const slitHalfGap = (this.slitSeparation / 2) * 8;
    const slitHalfH = (this.slitWidth / 2) * 8;

    ctx.fillStyle = '#334155';
    // Top section
    ctx.fillRect(this.slitX - barrierW / 2, 0, barrierW, cy - slitHalfGap - slitHalfH);
    // Middle section
    ctx.fillRect(this.slitX - barrierW / 2, cy - slitHalfGap + slitHalfH, barrierW, 2 * (slitHalfGap - slitHalfH));
    // Bottom section
    ctx.fillRect(this.slitX - barrierW / 2, cy + slitHalfGap + slitHalfH, barrierW, height - (cy + slitHalfGap + slitHalfH));

    // Slit highlights
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(this.slitX - barrierW / 2, cy - slitHalfGap - slitHalfH, barrierW, slitHalfH * 2);
    ctx.fillRect(this.slitX - barrierW / 2, cy + slitHalfGap - slitHalfH, barrierW, slitHalfH * 2);

    // --- Source ---
    ctx.beginPath();
    ctx.arc(this.sourceX, cy, 8, 0, Math.PI * 2);
    const srcGrad = ctx.createRadialGradient(this.sourceX, cy, 0, this.sourceX, cy, 12);
    srcGrad.addColorStop(0, '#a78bfa');
    srcGrad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = srcGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.sourceX, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#c4b5fd';
    ctx.fill();

    // --- Detection screen ---
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(this.screenX, 0, width - this.screenX, height);
    drawDashedLine(ctx, this.screenX, 0, this.screenX, height, '#475569', 1, [4, 4]);

    // --- Wave overlay ---
    if (this.showWaveOverlay) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      const waveRegionStart = this.slitX + barrierW;
      const waveRegionEnd = this.screenX;
      for (let x = waveRegionStart; x < waveRegionEnd; x += 3) {
        for (let y = 0; y < height; y += 3) {
          const dy1 = y - (cy - slitHalfGap);
          const dx1 = x - this.slitX;
          const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

          const dy2 = y - (cy + slitHalfGap);
          const r2 = Math.sqrt(dx1 * dx1 + dy2 * dy2);

          const k = (2 * Math.PI) / (this.wavelength * 8);
          const wave1 = Math.sin(k * r1 - this.time * 5);
          const wave2 = Math.sin(k * r2 - this.time * 5);
          const amp = (wave1 + wave2) / 2;
          const intensity = amp * amp;

          if (intensity > 0.1) {
            ctx.fillStyle = `rgba(96, 165, 250, ${intensity * 0.6})`;
            ctx.fillRect(x, y, 3, 3);
          }
        }
      }
      ctx.restore();
    }

    // --- Particles in flight ---
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 4);
      pGrad.addColorStop(0, '#e0e7ff');
      pGrad.addColorStop(1, 'rgba(167, 139, 250, 0)');
      ctx.fillStyle = pGrad;
      ctx.fill();
    }

    // --- Hits on detection screen (glowing dots) ---
    for (const h of this.hits) {
      const brightness = Math.max(0.3, 1 - h.age * 0.05);
      const r = Math.max(1, 2 - h.age * 0.02);
      ctx.beginPath();
      ctx.arc(this.screenX + 20, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250, 204, 21, ${brightness})`;
      ctx.fill();

      // Glow for recent hits
      if (h.age < 1) {
        ctx.beginPath();
        ctx.arc(this.screenX + 20, h.y, r + 3, 0, Math.PI * 2);
        const gGrad = ctx.createRadialGradient(
          this.screenX + 20, h.y, 0,
          this.screenX + 20, h.y, r + 5
        );
        gGrad.addColorStop(0, `rgba(250, 204, 21, ${(1 - h.age) * 0.5})`);
        gGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = gGrad;
        ctx.fill();
      }
    }

    // --- Histogram on right edge ---
    const maxCount = Math.max(1, ...this.histogram);
    const histWidth = width - this.screenX - 40;
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < this.histogramBins; i++) {
      if (this.histogram[i] === 0) continue;
      const y = (i / this.histogramBins) * height;
      const binH = height / this.histogramBins;
      const barW = (this.histogram[i] / maxCount) * histWidth;
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(this.screenX + 35, y, barW, Math.max(1, binH - 0.5));
    }
    ctx.restore();

    // --- Theoretical envelope on screen ---
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < height; y += 2) {
      const prob = this.interferenceProb(y);
      const x = this.screenX + 35 + prob * histWidth;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- Labels ---
    drawText(ctx, 'Source', this.sourceX, cy + 25, '#94a3b8', '11px system-ui', 'center');
    drawText(ctx, 'Double Slit', this.slitX, 18, '#94a3b8', '11px system-ui', 'center');
    drawText(ctx, 'Detection Screen', this.screenX + (width - this.screenX) / 2, 18, '#94a3b8', '11px system-ui', 'center');

    // --- Info overlay ---
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, 10, 180, 72);
    drawText(ctx, `Hits: ${this.hits.length}`, 20, 28, '#facc15', '13px monospace', 'left');
    drawText(ctx, `\u03BB = ${this.wavelength.toFixed(1)}`, 20, 46, '#60a5fa', '12px monospace', 'left');
    drawText(ctx, `d = ${this.slitSeparation.toFixed(1)}  a = ${this.slitWidth.toFixed(1)}`, 20, 64, '#60a5fa', '12px monospace', 'left');
  }

  reset(): void {
    this.particles = [];
    this.hits = [];
    this.histogram = new Array(this.histogramBins).fill(0);
    this.time = 0;
    this.fireTimer = 0;
  }

  resize(w: number, h: number, pr: number): void {
    super.resize(w, h, pr);
    this.recalcLayout();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'slitWidth', label: 'Slit Width', min: 0.5, max: 5, step: 0.1, defaultValue: 2, unit: 'a.u.' },
      { type: 'slider', key: 'slitSeparation', label: 'Slit Separation', min: 2, max: 20, step: 0.5, defaultValue: 8, unit: 'a.u.' },
      { type: 'slider', key: 'wavelength', label: 'Wavelength', min: 1, max: 10, step: 0.1, defaultValue: 4, unit: 'a.u.' },
      { type: 'toggle', key: 'showWaveOverlay', label: 'Wave Overlay', defaultValue: false },
      { type: 'toggle', key: 'continuousMode', label: 'Continuous Fire', defaultValue: false },
      { type: 'button', key: 'fire', label: 'Fire Particle' },
      { type: 'button', key: 'resetScreen', label: 'Reset Screen' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      slitWidth: this.slitWidth,
      slitSeparation: this.slitSeparation,
      wavelength: this.wavelength,
      showWaveOverlay: this.showWaveOverlay,
      continuousMode: this.continuousMode,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'slitWidth': this.slitWidth = value as number; break;
      case 'slitSeparation': this.slitSeparation = value as number; break;
      case 'wavelength': this.wavelength = value as number; break;
      case 'showWaveOverlay': this.showWaveOverlay = value as boolean; break;
      case 'continuousMode': this.continuousMode = value as boolean; break;
      case 'fire': this.fireParticle(); break;
      case 'resetScreen': this.reset(); break;
    }
  }

  onPointerDown(x: number, y: number): void {
    this.fireParticle();
  }
}

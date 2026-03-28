import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawText, clearCanvas } from '@/engine/render/drawUtils.ts';

type CrossSection = 'xz' | 'xy';

export default class HydrogenOrbitalsSim extends SimulationEngine {
  /* --- controls --- */
  private n = 1;
  private l = 0;
  private m = 0;
  private crossSection: CrossSection = 'xz';
  private showRadialOverlay = false;

  /* --- precomputed density map --- */
  private densityImage: ImageData | null = null;
  private needsRecompute = true;

  /* --- layout --- */
  private mapSize = 0;
  private mapX = 0;
  private mapY = 0;

  setup(): void {
    this.recalcLayout();
    this.needsRecompute = true;
  }

  private recalcLayout(): void {
    this.mapSize = Math.min(this.width - 100, this.height - 120);
    this.mapX = (this.width - this.mapSize) / 2;
    this.mapY = (this.height - this.mapSize) / 2 + 20;
  }

  /* ============ HYDROGEN WAVEFUNCTION MATH ============ */

  /** Associated Laguerre polynomial L^alpha_k(x) via recurrence */
  private laguerre(k: number, alpha: number, x: number): number {
    if (k === 0) return 1;
    if (k === 1) return 1 + alpha - x;
    let L0 = 1;
    let L1 = 1 + alpha - x;
    for (let i = 2; i <= k; i++) {
      const L2 = ((2 * i - 1 + alpha - x) * L1 - (i - 1 + alpha) * L0) / i;
      L0 = L1;
      L1 = L2;
    }
    return L1;
  }

  /** Associated Legendre polynomial P^m_l(x) */
  private legendreP(l: number, m: number, x: number): number {
    const am = Math.abs(m);
    // P^m_m starting
    let pmm = 1.0;
    if (am > 0) {
      const somx2 = Math.sqrt(Math.max(0, (1 - x) * (1 + x)));
      let fact = 1.0;
      for (let i = 1; i <= am; i++) {
        pmm *= -fact * somx2;
        fact += 2.0;
      }
    }
    if (l === am) return pmm;

    let pmmp1 = x * (2 * am + 1) * pmm;
    if (l === am + 1) return pmmp1;

    let pll = 0;
    for (let ll = am + 2; ll <= l; ll++) {
      pll = (x * (2 * ll - 1) * pmmp1 - (ll + am - 1) * pmm) / (ll - am);
      pmm = pmmp1;
      pmmp1 = pll;
    }
    return pll;
  }

  private factorial(n: number): number {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  /** Radial wavefunction R_{nl}(r) (a0 = 1) */
  private radialR(n: number, l: number, r: number): number {
    const rho = (2 * r) / n;
    const normSq =
      (8 / (n * n * n)) *
      (this.factorial(n - l - 1) / (2 * n * this.factorial(n + l)));
    // The formula: we use absolute value of normSq to be safe
    const norm = Math.sqrt(Math.abs(normSq));
    return norm * Math.exp(-rho / 2) * Math.pow(rho, l) * this.laguerre(n - l - 1, 2 * l + 1, rho);
  }

  /** Spherical harmonic Y_{lm}(theta, phi) - real valued version for visualization */
  private sphericalYReal(l: number, m: number, theta: number, phi: number): number {
    const am = Math.abs(m);
    const normSq =
      ((2 * l + 1) / (4 * Math.PI)) *
      (this.factorial(l - am) / this.factorial(l + am));
    const norm = Math.sqrt(Math.abs(normSq));
    const plm = this.legendreP(l, am, Math.cos(theta));

    if (m > 0) {
      return norm * plm * Math.cos(m * phi) * Math.SQRT2;
    } else if (m < 0) {
      return norm * plm * Math.sin(am * phi) * Math.SQRT2;
    }
    return norm * plm;
  }

  /** Probability density at a point for given cross section */
  private probDensity(px: number, py: number): number {
    // px, py are in units of a0, centered at nucleus
    let r: number, theta: number, phi: number;

    if (this.crossSection === 'xz') {
      // xz plane: y=0, so x=px, z=py
      const x = px;
      const z = py;
      r = Math.sqrt(x * x + z * z);
      theta = Math.atan2(Math.sqrt(x * x), z); // angle from z-axis
      phi = (x >= 0) ? 0 : Math.PI;
    } else {
      // xy plane: z=0, so x=px, y=py
      const x = px;
      const y = py;
      r = Math.sqrt(x * x + y * y);
      theta = Math.PI / 2; // in xy plane, theta = pi/2
      phi = Math.atan2(y, x);
    }

    if (r < 1e-10) r = 1e-10;

    const R = this.radialR(this.n, this.l, r);
    const Y = this.sphericalYReal(this.l, this.m, theta, phi);
    const psi = R * Y;
    return psi * psi;
  }

  private computeDensityMap(): void {
    const size = Math.min(this.mapSize, 300); // render at moderate resolution
    const imageData = this.ctx.createImageData(size, size);

    // Range in a0 units scales with n^2
    const range = this.n * this.n * 4 + 5;

    // First pass: find max density for normalization
    let maxDens = 0;
    const densValues: number[] = new Array(size * size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const px = ((i / size) * 2 - 1) * range;
        const py = ((1 - j / size) * 2 - 1) * range;
        const d = this.probDensity(px, py);
        densValues[j * size + i] = d;
        if (d > maxDens) maxDens = d;
      }
    }

    if (maxDens < 1e-20) maxDens = 1e-20;

    // Second pass: colorize
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const idx = (j * size + i) * 4;
        const d = densValues[j * size + i];
        // Normalize with gamma correction for better visibility
        const t = Math.pow(d / maxDens, 0.4);

        // Color map: dark blue -> cyan -> yellow -> white
        let r: number, g: number, b: number;
        if (t < 0.25) {
          const s = t / 0.25;
          r = 10 + s * 10;
          g = 15 + s * 40;
          b = 60 + s * 100;
        } else if (t < 0.5) {
          const s = (t - 0.25) / 0.25;
          r = 20 + s * 20;
          g = 55 + s * 120;
          b = 160 + s * 40;
        } else if (t < 0.75) {
          const s = (t - 0.5) / 0.25;
          r = 40 + s * 180;
          g = 175 + s * 60;
          b = 200 - s * 120;
        } else {
          const s = (t - 0.75) / 0.25;
          r = 220 + s * 35;
          g = 235 + s * 20;
          b = 80 + s * 175;
        }

        imageData.data[idx] = Math.min(255, Math.floor(r));
        imageData.data[idx + 1] = Math.min(255, Math.floor(g));
        imageData.data[idx + 2] = Math.min(255, Math.floor(b));
        imageData.data[idx + 3] = Math.max(30, Math.min(255, Math.floor(t * 300)));
      }
    }

    this.densityImage = imageData;
    this.needsRecompute = false;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.needsRecompute) {
      this.computeDensityMap();
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');

    this.recalcLayout();

    // Draw density map
    if (this.densityImage) {
      // Draw to offscreen then scale up
      const offCanvas = new OffscreenCanvas(this.densityImage.width, this.densityImage.height);
      const offCtx = offCanvas.getContext('2d')!;
      offCtx.putImageData(this.densityImage, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offCanvas, this.mapX, this.mapY, this.mapSize, this.mapSize);
    }

    // --- Crosshair axes ---
    const cx = this.mapX + this.mapSize / 2;
    const cy = this.mapY + this.mapSize / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.mapX, cy);
    ctx.lineTo(this.mapX + this.mapSize, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, this.mapY);
    ctx.lineTo(cx, this.mapY + this.mapSize);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Axis labels
    if (this.crossSection === 'xz') {
      drawText(ctx, 'x', this.mapX + this.mapSize + 8, cy, '#94a3b8', '13px system-ui', 'left');
      drawText(ctx, 'z', cx, this.mapY - 8, '#94a3b8', '13px system-ui', 'center');
    } else {
      drawText(ctx, 'x', this.mapX + this.mapSize + 8, cy, '#94a3b8', '13px system-ui', 'left');
      drawText(ctx, 'y', cx, this.mapY - 8, '#94a3b8', '13px system-ui', 'center');
    }

    // Nucleus dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // --- Radial distribution overlay ---
    if (this.showRadialOverlay) {
      const range = this.n * this.n * 4 + 5;
      const halfMap = this.mapSize / 2;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
      ctx.lineWidth = 2;
      const steps = 200;
      let maxRad = 0;
      const radVals: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const r = (i / steps) * range;
        const R = this.radialR(this.n, this.l, r);
        const val = r * r * R * R;
        radVals.push(val);
        if (val > maxRad) maxRad = val;
      }
      if (maxRad < 1e-20) maxRad = 1e-20;

      for (let i = 0; i <= steps; i++) {
        const r = (i / steps) * range;
        const screenR = (r / range) * halfMap;
        const val = radVals[i] / maxRad;
        const screenX = cx + screenR;
        const screenY = cy - val * 60;
        if (i === 0) ctx.moveTo(screenX, screenY); else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
      drawText(ctx, 'r\u00B2|R(r)|\u00B2', cx + halfMap * 0.6, cy - 65, '#facc15', '11px monospace', 'left');
    }

    // --- Orbital name & quantum numbers ---
    const orbitalLetters = ['s', 'p', 'd', 'f'];
    const orbitalName = `${this.n}${orbitalLetters[this.l] || '?'}`;
    drawText(ctx, orbitalName, width / 2, 22, '#e2e8f0', 'bold 22px system-ui', 'center');

    const qLabel = `n=${this.n}  l=${this.l}  m=${this.m}`;
    drawText(ctx, qLabel, width / 2, 46, '#a78bfa', '14px monospace', 'center');

    const planeLabel = `Cross-section: ${this.crossSection} plane`;
    drawText(ctx, planeLabel, width / 2, height - 18, '#64748b', '11px system-ui', 'center');

    // --- Color bar ---
    const barX = this.mapX + this.mapSize + 20;
    const barW = 14;
    const barTop = this.mapY + 20;
    const barH = this.mapSize - 40;
    for (let j = 0; j < barH; j++) {
      const t = 1 - j / barH;
      let r: number, g: number, b: number;
      if (t < 0.25) {
        const s = t / 0.25;
        r = 10 + s * 10; g = 15 + s * 40; b = 60 + s * 100;
      } else if (t < 0.5) {
        const s = (t - 0.25) / 0.25;
        r = 20 + s * 20; g = 55 + s * 120; b = 160 + s * 40;
      } else if (t < 0.75) {
        const s = (t - 0.5) / 0.25;
        r = 40 + s * 180; g = 175 + s * 60; b = 200 - s * 120;
      } else {
        const s = (t - 0.75) / 0.25;
        r = 220 + s * 35; g = 235 + s * 20; b = 80 + s * 175;
      }
      ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
      ctx.fillRect(barX, barTop + j, barW, 1);
    }
    drawText(ctx, 'High', barX + barW + 5, barTop + 5, '#94a3b8', '10px system-ui', 'left');
    drawText(ctx, 'Low', barX + barW + 5, barTop + barH - 5, '#94a3b8', '10px system-ui', 'left');
    drawText(ctx, '|\u03C8|\u00B2', barX + barW / 2, barTop - 10, '#94a3b8', '11px monospace', 'center');
  }

  reset(): void {
    this.time = 0;
    this.needsRecompute = true;
  }

  resize(w: number, h: number, pr: number): void {
    super.resize(w, h, pr);
    this.recalcLayout();
    this.needsRecompute = true;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'n', label: 'Principal n', min: 1, max: 4, step: 1, defaultValue: 1 },
      { type: 'slider', key: 'l', label: 'Angular l', min: 0, max: 3, step: 1, defaultValue: 0 },
      { type: 'slider', key: 'm', label: 'Magnetic m', min: -3, max: 3, step: 1, defaultValue: 0 },
      {
        type: 'dropdown', key: 'crossSection', label: 'Cross Section', defaultValue: 'xz',
        options: [
          { value: 'xz', label: 'xz plane' },
          { value: 'xy', label: 'xy plane' },
        ],
      },
      { type: 'toggle', key: 'showRadialOverlay', label: 'Radial Distribution', defaultValue: false },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      n: this.n,
      l: this.l,
      m: this.m,
      crossSection: this.crossSection,
      showRadialOverlay: this.showRadialOverlay,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'n':
        this.n = value as number;
        // Clamp l and m
        if (this.l >= this.n) this.l = this.n - 1;
        if (Math.abs(this.m) > this.l) this.m = 0;
        this.needsRecompute = true;
        break;
      case 'l':
        this.l = Math.min(value as number, this.n - 1);
        if (Math.abs(this.m) > this.l) this.m = 0;
        this.needsRecompute = true;
        break;
      case 'm':
        this.m = Math.max(-this.l, Math.min(this.l, value as number));
        this.needsRecompute = true;
        break;
      case 'crossSection':
        this.crossSection = value as CrossSection;
        this.needsRecompute = true;
        break;
      case 'showRadialOverlay':
        this.showRadialOverlay = value as boolean;
        break;
    }
  }
}

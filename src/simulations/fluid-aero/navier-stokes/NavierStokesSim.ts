import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { clearCanvas, drawArrow, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

// Jos Stam "Stable Fluids" — 2D Eulerian grid
export default class NavierStokesSim extends SimulationEngine {
  private N = 80;
  private M = 60;
  private size = 0;

  // Fluid fields (length = (N+2)*(M+2))
  private u!: Float32Array;
  private v!: Float32Array;
  private uPrev!: Float32Array;
  private vPrev!: Float32Array;
  private dens!: Float32Array;
  private densPrev!: Float32Array;

  // Controls
  private viscosity = 0.0001;
  private diffusion = 0.0001;
  private dyeRate = 2.0;
  private showVelocity = false;
  private colorByVelocity = false;
  private dyePreset: string = 'ocean';

  // Interaction
  private pointerDown = false;
  private px = 0;
  private py = 0;
  private lastPx = 0;
  private lastPy = 0;

  // Image buffer
  private imageData!: ImageData;

  private ix(i: number, j: number): number {
    return i + (this.N + 2) * j;
  }

  setup(): void {
    this.N = Math.max(60, Math.floor(this.width / 8));
    this.M = Math.max(40, Math.floor(this.height / 8));
    const sz = (this.N + 2) * (this.M + 2);
    this.size = sz;
    this.u = new Float32Array(sz);
    this.v = new Float32Array(sz);
    this.uPrev = new Float32Array(sz);
    this.vPrev = new Float32Array(sz);
    this.dens = new Float32Array(sz);
    this.densPrev = new Float32Array(sz);
    this.imageData = this.ctx.createImageData(this.N, this.M);
    this.time = 0;
  }

  reset(): void {
    this.u.fill(0); this.v.fill(0);
    this.uPrev.fill(0); this.vPrev.fill(0);
    this.dens.fill(0); this.densPrev.fill(0);
    this.time = 0;
  }

  // ---- Stable Fluids core ----

  private setBoundary(b: number, x: Float32Array): void {
    const N = this.N, M = this.M;
    for (let i = 1; i <= N; i++) {
      x[this.ix(i, 0)] = b === 2 ? -x[this.ix(i, 1)] : x[this.ix(i, 1)];
      x[this.ix(i, M + 1)] = b === 2 ? -x[this.ix(i, M)] : x[this.ix(i, M)];
    }
    for (let j = 1; j <= M; j++) {
      x[this.ix(0, j)] = b === 1 ? -x[this.ix(1, j)] : x[this.ix(1, j)];
      x[this.ix(N + 1, j)] = b === 1 ? -x[this.ix(N, j)] : x[this.ix(N, j)];
    }
    x[this.ix(0, 0)] = 0.5 * (x[this.ix(1, 0)] + x[this.ix(0, 1)]);
    x[this.ix(N + 1, 0)] = 0.5 * (x[this.ix(N, 0)] + x[this.ix(N + 1, 1)]);
    x[this.ix(0, M + 1)] = 0.5 * (x[this.ix(1, M + 1)] + x[this.ix(0, M)]);
    x[this.ix(N + 1, M + 1)] = 0.5 * (x[this.ix(N, M + 1)] + x[this.ix(N + 1, M)]);
  }

  private linSolve(b: number, x: Float32Array, x0: Float32Array, a: number, c: number, iters: number): void {
    const N = this.N, M = this.M;
    const cInv = 1 / c;
    for (let k = 0; k < iters; k++) {
      for (let j = 1; j <= M; j++) {
        for (let i = 1; i <= N; i++) {
          x[this.ix(i, j)] = (x0[this.ix(i, j)] + a * (
            x[this.ix(i - 1, j)] + x[this.ix(i + 1, j)] +
            x[this.ix(i, j - 1)] + x[this.ix(i, j + 1)]
          )) * cInv;
        }
      }
      this.setBoundary(b, x);
    }
  }

  private diffuse(b: number, x: Float32Array, x0: Float32Array, diff: number, dt: number): void {
    const N = this.N, M = this.M;
    const a = dt * diff * N * M;
    this.linSolve(b, x, x0, a, 1 + 4 * a, 4);
  }

  private advect(b: number, d: Float32Array, d0: Float32Array, u: Float32Array, v: Float32Array, dt: number): void {
    const N = this.N, M = this.M;
    const dt0x = dt * N;
    const dt0y = dt * M;
    for (let j = 1; j <= M; j++) {
      for (let i = 1; i <= N; i++) {
        let x = i - dt0x * u[this.ix(i, j)];
        let y = j - dt0y * v[this.ix(i, j)];
        x = Math.max(0.5, Math.min(N + 0.5, x));
        y = Math.max(0.5, Math.min(M + 0.5, y));
        const i0 = Math.floor(x), i1 = i0 + 1;
        const j0 = Math.floor(y), j1 = j0 + 1;
        const s1 = x - i0, s0 = 1 - s1;
        const t1 = y - j0, t0 = 1 - t1;
        d[this.ix(i, j)] =
          s0 * (t0 * d0[this.ix(i0, j0)] + t1 * d0[this.ix(i0, j1)]) +
          s1 * (t0 * d0[this.ix(i1, j0)] + t1 * d0[this.ix(i1, j1)]);
      }
    }
    this.setBoundary(b, d);
  }

  private project(u: Float32Array, v: Float32Array, p: Float32Array, div: Float32Array): void {
    const N = this.N, M = this.M;
    const hx = 1.0 / N, hy = 1.0 / M;
    for (let j = 1; j <= M; j++) {
      for (let i = 1; i <= N; i++) {
        div[this.ix(i, j)] = -0.5 * (
          hx * (u[this.ix(i + 1, j)] - u[this.ix(i - 1, j)]) +
          hy * (v[this.ix(i, j + 1)] - v[this.ix(i, j - 1)])
        );
        p[this.ix(i, j)] = 0;
      }
    }
    this.setBoundary(0, div);
    this.setBoundary(0, p);
    this.linSolve(0, p, div, 1, 4, 10);
    for (let j = 1; j <= M; j++) {
      for (let i = 1; i <= N; i++) {
        u[this.ix(i, j)] -= 0.5 * N * (p[this.ix(i + 1, j)] - p[this.ix(i - 1, j)]);
        v[this.ix(i, j)] -= 0.5 * M * (p[this.ix(i, j + 1)] - p[this.ix(i, j - 1)]);
      }
    }
    this.setBoundary(1, u);
    this.setBoundary(2, v);
  }

  private velStep(dt: number): void {
    const { u, v, uPrev, vPrev } = this;
    this.addSource(u, uPrev, dt);
    this.addSource(v, vPrev, dt);
    // swap
    u.set(uPrev); this.diffuse(1, uPrev, u, this.viscosity, dt);
    v.set(vPrev); this.diffuse(2, vPrev, v, this.viscosity, dt);
    this.project(uPrev, vPrev, u, v);
    this.advect(1, u, uPrev, uPrev, vPrev, dt);
    this.advect(2, v, vPrev, uPrev, vPrev, dt);
    this.project(u, v, uPrev, vPrev);
  }

  private densStep(dt: number): void {
    const { dens, densPrev } = this;
    this.addSource(dens, densPrev, dt);
    dens.set(densPrev);
    this.diffuse(0, densPrev, dens, this.diffusion, dt);
    this.advect(0, dens, densPrev, this.u, this.v, dt);
  }

  private addSource(x: Float32Array, s: Float32Array, dt: number): void {
    for (let i = 0; i < this.size; i++) x[i] += dt * s[i];
  }

  update(dt: number): void {
    const clampedDt = Math.min(dt, 0.033) * this.speed;

    // Clear prev sources
    this.uPrev.fill(0);
    this.vPrev.fill(0);
    this.densPrev.fill(0);

    // Inject from pointer drag
    if (this.pointerDown) {
      const fx = (this.px / this.width) * this.N;
      const fy = (this.py / this.height) * this.M;
      const ci = Math.round(fx);
      const cj = Math.round(fy);
      const vx = (this.px - this.lastPx) * 5;
      const vy = (this.py - this.lastPy) * 5;
      for (let di = -2; di <= 2; di++) {
        for (let dj = -2; dj <= 2; dj++) {
          const ii = ci + di, jj = cj + dj;
          if (ii >= 1 && ii <= this.N && jj >= 1 && jj <= this.M) {
            this.uPrev[this.ix(ii, jj)] += vx;
            this.vPrev[this.ix(ii, jj)] += vy;
            this.densPrev[this.ix(ii, jj)] += this.dyeRate * 100;
          }
        }
      }
      this.lastPx = this.px;
      this.lastPy = this.py;
    }

    this.velStep(clampedDt);
    this.densStep(clampedDt);
    this.time += clampedDt;
  }

  private dyeColor(d: number, velMag: number): [number, number, number] {
    const t = Math.min(1, d / 1.5);
    const vm = Math.min(1, velMag * 5);

    if (this.colorByVelocity) {
      // velocity magnitude: black → purple → cyan → white
      const r = Math.round(vm * 200);
      const g = Math.round(vm * 100);
      const b = Math.round(100 + vm * 155);
      return [r, g, b];
    }

    switch (this.dyePreset) {
      case 'fire': {
        const r = Math.round(t * 255);
        const g = Math.round(Math.pow(t, 2) * 160);
        const b = Math.round(Math.pow(t, 4) * 40);
        return [r, g, b];
      }
      case 'rainbow': {
        const hue = (t * 300);
        return this.hslToRgb(hue / 360, 1, 0.5 * t);
      }
      case 'neon': {
        const r = Math.round(t * 50);
        const g = Math.round(t * 255);
        const b = Math.round(t * 200);
        return [r, g, b];
      }
      default: { // ocean
        const r = Math.round(t * 40);
        const g = Math.round(t * 180);
        const b = Math.round(80 + t * 175);
        return [r, g, b];
      }
    }
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 1/6) { r = c; g = x; }
    else if (h < 2/6) { r = x; g = c; }
    else if (h < 3/6) { g = c; b = x; }
    else if (h < 4/6) { g = x; b = c; }
    else if (h < 5/6) { r = x; b = c; }
    else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  render(): void {
    const { ctx, width, height, N, M } = this;
    clearCanvas(ctx, width, height, '#09090b');

    // Render fluid via ImageData (pixel-based)
    const data = this.imageData.data;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const idx = this.ix(i + 1, j + 1);
        const d = this.dens[idx];
        const uu = this.u[idx], vv = this.v[idx];
        const velMag = Math.sqrt(uu * uu + vv * vv);
        const [r, g, b] = this.dyeColor(d, velMag);
        const pIdx = (j * N + i) * 4;
        data[pIdx] = r;
        data[pIdx + 1] = g;
        data[pIdx + 2] = b;
        data[pIdx + 3] = 255;
      }
    }

    // Scale image to canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = N;
    offCanvas.height = M;
    const offCtx = offCanvas.getContext('2d')!;
    offCtx.putImageData(this.imageData, 0, 0);
    ctx.drawImage(offCanvas, 0, 0, width, height);

    // Velocity field overlay
    if (this.showVelocity) {
      const step = 8;
      const scaleX = width / N;
      const scaleY = height / M;
      for (let j = step; j <= M - step; j += step) {
        for (let i = step; i <= N - step; i += step) {
          const idx = this.ix(i, j);
          const uu = this.u[idx] * 20;
          const vv = this.v[idx] * 20;
          const x = i * scaleX, y = j * scaleY;
          const len = Math.sqrt(uu * uu + vv * vv);
          if (len > 0.5) {
            drawArrow(ctx, x, y, x + uu, y + vv, 'rgba(255,255,100,0.5)', 1, 4);
          }
        }
      }
    }

    // HUD
    drawText(ctx, 'Drag to inject dye + velocity', 12, height - 14, 'rgba(148,163,184,0.6)', '12px system-ui');
    drawText(ctx, `t = ${this.time.toFixed(2)}s`, width - 12, 18, 'rgba(148,163,184,0.7)', '12px system-ui', 'right');
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'viscosity', label: 'Viscosity', min: 0.0001, max: 0.01, step: 0.0001, defaultValue: 0.0001 },
      { type: 'slider', key: 'diffusion', label: 'Diffusion', min: 0.0001, max: 0.01, step: 0.0001, defaultValue: 0.0001 },
      { type: 'slider', key: 'dyeRate', label: 'Dye Rate', min: 0.1, max: 5, step: 0.1, defaultValue: 2.0 },
      { type: 'toggle', key: 'showVelocity', label: 'Velocity Field', defaultValue: false },
      { type: 'toggle', key: 'colorByVelocity', label: 'Color by Velocity', defaultValue: false },
      {
        type: 'dropdown', key: 'dyePreset', label: 'Dye Color',
        options: [
          { value: 'ocean', label: 'Ocean' },
          { value: 'fire', label: 'Fire' },
          { value: 'rainbow', label: 'Rainbow' },
          { value: 'neon', label: 'Neon' },
        ],
        defaultValue: 'ocean',
      },
      { type: 'button', key: 'clearDye', label: 'Clear Dye' },
      { type: 'button', key: 'reset', label: 'Reset' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      viscosity: this.viscosity,
      diffusion: this.diffusion,
      dyeRate: this.dyeRate,
      showVelocity: this.showVelocity,
      colorByVelocity: this.colorByVelocity,
      dyePreset: this.dyePreset,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'viscosity': this.viscosity = value as number; break;
      case 'diffusion': this.diffusion = value as number; break;
      case 'dyeRate': this.dyeRate = value as number; break;
      case 'showVelocity': this.showVelocity = value as boolean; break;
      case 'colorByVelocity': this.colorByVelocity = value as boolean; break;
      case 'dyePreset': this.dyePreset = value as string; break;
      case 'clearDye': this.dens.fill(0); this.densPrev.fill(0); break;
      case 'reset': this.reset(); break;
    }
  }

  onPointerDown(x: number, y: number): void {
    this.pointerDown = true;
    this.px = x; this.py = y;
    this.lastPx = x; this.lastPy = y;
  }

  onPointerMove(x: number, y: number): void {
    if (!this.pointerDown) return;
    this.lastPx = this.px;
    this.lastPy = this.py;
    this.px = x; this.py = y;
  }

  onPointerUp(_x: number, _y: number): void {
    this.pointerDown = false;
  }
}

import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { clearCanvas, drawText, drawArrow } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

// Jos Stam Stable Fluids — adapted for Kármán vortex street with cylinder obstacle
export default class KarmanVortexSim extends SimulationEngine {
  private N = 120;
  private M = 80;
  private size = 0;

  // Fluid fields
  private u!: Float32Array;
  private v!: Float32Array;
  private uPrev!: Float32Array;
  private vPrev!: Float32Array;
  private dens!: Float32Array;
  private densPrev!: Float32Array;

  // Cylinder obstacle
  private solid!: Uint8Array;
  private cylI = 30;  // cylinder grid center x
  private cylJ = 0;   // cylinder grid center y (set in setup)
  private cylR = 8;   // cylinder grid radius

  // Controls
  private freestreamVel = 1.5;
  private viscosity = 0.0003;
  private showVelocity = false;
  private colorByVorticity = true;

  // Display
  private imageData!: ImageData;
  private Re = 0;

  // Dye injection pulse timer
  private dyePulse = 0;

  private ix(i: number, j: number): number {
    return i + (this.N + 2) * j;
  }

  setup(): void {
    this.N = Math.max(100, Math.floor(this.width / 6));
    this.M = Math.max(60, Math.floor(this.height / 6));
    const sz = (this.N + 2) * (this.M + 2);
    this.size = sz;
    this.cylI = Math.round(this.N * 0.25);
    this.cylJ = Math.round(this.M / 2);
    this.cylR = Math.round(this.M * 0.10);

    this.u = new Float32Array(sz);
    this.v = new Float32Array(sz);
    this.uPrev = new Float32Array(sz);
    this.vPrev = new Float32Array(sz);
    this.dens = new Float32Array(sz);
    this.densPrev = new Float32Array(sz);
    this.solid = new Uint8Array(sz);
    this.imageData = this.ctx.createImageData(this.N, this.M);

    // Mark cylinder cells
    for (let j = 0; j <= this.M + 1; j++) {
      for (let i = 0; i <= this.N + 1; i++) {
        const di = i - this.cylI;
        const dj = j - this.cylJ;
        if (di * di + dj * dj <= this.cylR * this.cylR) {
          this.solid[this.ix(i, j)] = 1;
        }
      }
    }

    // Initial freestream
    for (let j = 0; j <= this.M + 1; j++) {
      for (let i = 0; i <= this.N + 1; i++) {
        if (!this.solid[this.ix(i, j)]) {
          this.u[this.ix(i, j)] = this.freestreamVel;
        }
      }
    }

    // Initial dye stripe
    this.injectDyeStripe();
    this.time = 0;
    this.computeRe();
  }

  reset(): void {
    this.setup();
  }

  private computeRe(): void {
    // Re = rho * V * D / mu, where D = cylinder diameter in meters, L = 0.1m
    const mu = this.viscosity;
    const D = 2 * this.cylR; // grid cells
    this.Re = (1.2 * this.freestreamVel * D) / (mu * this.N + 0.001);
  }

  private injectDyeStripe(): void {
    const stripeX = Math.round(this.N * 0.05);
    for (let j = 1; j <= this.M; j++) {
      const phase = (j / this.M) * 6;
      const c = (Math.sin(phase) + 1) / 2;
      if (!this.solid[this.ix(stripeX, j)]) {
        this.dens[this.ix(stripeX, j)] += 2.0 + c;
      }
    }
  }

  // ---- Stable Fluids core ----

  private setBoundary(b: number, x: Float32Array): void {
    const N = this.N, M = this.M;
    for (let i = 1; i <= N; i++) {
      x[this.ix(i, 0)] = b === 2 ? -x[this.ix(i, 1)] : x[this.ix(i, 1)];
      x[this.ix(i, M + 1)] = b === 2 ? -x[this.ix(i, M)] : x[this.ix(i, M)];
    }
    // Left boundary: drive freestream (inflow)
    for (let j = 1; j <= M; j++) {
      x[this.ix(0, j)] = b === 1 ? this.freestreamVel : x[this.ix(1, j)];
      x[this.ix(N + 1, j)] = b === 1 ? x[this.ix(N, j)] : x[this.ix(N, j)];
    }
    // Corners
    x[this.ix(0, 0)] = 0.5 * (x[this.ix(1, 0)] + x[this.ix(0, 1)]);
    x[this.ix(N + 1, 0)] = 0.5 * (x[this.ix(N, 0)] + x[this.ix(N + 1, 1)]);
    x[this.ix(0, M + 1)] = 0.5 * (x[this.ix(1, M + 1)] + x[this.ix(0, M)]);
    x[this.ix(N + 1, M + 1)] = 0.5 * (x[this.ix(N, M + 1)] + x[this.ix(N + 1, M)]);

    // Zero velocity inside solid
    for (let idx = 0; idx < this.size; idx++) {
      if (this.solid[idx]) x[idx] = 0;
    }
  }

  private linSolve(b: number, x: Float32Array, x0: Float32Array, a: number, c: number, iters: number): void {
    const N = this.N, M = this.M;
    const cInv = 1 / c;
    for (let k = 0; k < iters; k++) {
      for (let j = 1; j <= M; j++) {
        for (let i = 1; i <= N; i++) {
          if (this.solid[this.ix(i, j)]) continue;
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
        if (this.solid[this.ix(i, j)]) { d[this.ix(i, j)] = 0; continue; }
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
        if (this.solid[this.ix(i, j)]) { div[this.ix(i, j)] = 0; p[this.ix(i, j)] = 0; continue; }
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
        if (this.solid[this.ix(i, j)]) continue;
        u[this.ix(i, j)] -= 0.5 * N * (p[this.ix(i + 1, j)] - p[this.ix(i - 1, j)]);
        v[this.ix(i, j)] -= 0.5 * M * (p[this.ix(i, j + 1)] - p[this.ix(i, j - 1)]);
      }
    }
    this.setBoundary(1, u);
    this.setBoundary(2, v);
  }

  private addSource(x: Float32Array, s: Float32Array, dt: number): void {
    for (let i = 0; i < this.size; i++) x[i] += dt * s[i];
  }

  private velStep(dt: number): void {
    const { u, v, uPrev, vPrev } = this;
    this.addSource(u, uPrev, dt);
    this.addSource(v, vPrev, dt);
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
    this.diffuse(0, densPrev, dens, 0.00005, dt);
    this.advect(0, dens, densPrev, this.u, this.v, dt);
  }

  // Compute vorticity: ω = ∂v/∂x - ∂u/∂y
  private vorticity(i: number, j: number): number {
    return (
      (this.v[this.ix(i + 1, j)] - this.v[this.ix(i - 1, j)]) * this.N * 0.5 -
      (this.u[this.ix(i, j + 1)] - this.u[this.ix(i, j - 1)]) * this.M * 0.5
    );
  }

  update(dt: number): void {
    const clampedDt = Math.min(dt, 0.033) * this.speed;

    this.uPrev.fill(0);
    this.vPrev.fill(0);
    this.densPrev.fill(0);

    // Continuously drive left inflow dye
    for (let j = 1; j <= this.M; j++) {
      const idx = this.ix(1, j);
      if (!this.solid[idx]) {
        this.uPrev[idx] += this.freestreamVel * 5;
        // Color bands from left
        const phase = (j / this.M) * 6;
        const c = (Math.sin(phase) + 1) / 2;
        this.densPrev[idx] += 0.5 + c * 0.5;
      }
    }

    // Dye pulse if requested
    if (this.dyePulse > 0) {
      this.injectDyeStripe();
      this.dyePulse--;
    }

    this.velStep(clampedDt);
    this.densStep(clampedDt);
    this.computeRe();
    this.time += clampedDt;
  }

  render(): void {
    const { ctx, width, height, N, M } = this;
    clearCanvas(ctx, width, height, '#09090b');

    const data = this.imageData.data;

    for (let j = 0; j < M; j++) {
      for (let i = 0; i < N; i++) {
        const idx = this.ix(i + 1, j + 1);
        const pIdx = (j * N + i) * 4;

        if (this.solid[idx]) {
          data[pIdx] = 80; data[pIdx + 1] = 100; data[pIdx + 2] = 130; data[pIdx + 3] = 255;
          continue;
        }

        if (this.colorByVorticity) {
          // Vorticity coloring: blue = clockwise, red = counterclockwise
          let omega = 0;
          if (i > 0 && i < N - 1 && j > 0 && j < M - 1) {
            omega = this.vorticity(i + 1, j + 1);
          }
          const d = this.dens[idx];
          const vNorm = Math.tanh(omega * 0.5) * 0.5 + 0.5; // 0=blue, 1=red
          const dBase = Math.min(1, d * 0.6);
          const r = Math.round((vNorm * 180 + d * 40) * dBase);
          const g = Math.round(d * 60 * dBase);
          const b = Math.round(((1 - vNorm) * 180 + d * 40) * dBase);
          const alpha = Math.min(255, Math.round(dBase * 255 + omega !== 0 ? 40 : 0));
          data[pIdx] = r; data[pIdx + 1] = g; data[pIdx + 2] = b; data[pIdx + 3] = alpha;
        } else {
          const d = Math.min(1, this.dens[idx] / 2);
          const uu = this.u[idx], vv = this.v[idx];
          const speed = Math.sqrt(uu * uu + vv * vv);
          const sNorm = Math.min(1, speed / (this.freestreamVel * 2));
          data[pIdx] = Math.round(sNorm * 80 + d * 40);
          data[pIdx + 1] = Math.round(d * 180);
          data[pIdx + 2] = Math.round(80 + d * 175);
          data[pIdx + 3] = 255;
        }
      }
    }

    // Scale to canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = N;
    offCanvas.height = M;
    const offCtx = offCanvas.getContext('2d')!;
    offCtx.putImageData(this.imageData, 0, 0);
    ctx.drawImage(offCanvas, 0, 0, width, height);

    // Draw cylinder outline
    const scaleX = width / N;
    const scaleY = height / M;
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.cylI * scaleX, this.cylJ * scaleY, this.cylR * Math.min(scaleX, scaleY), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Velocity field overlay
    if (this.showVelocity) {
      const step = 8;
      for (let j = step; j <= M - step; j += step) {
        for (let i = step; i <= N - step; i += step) {
          const idx = this.ix(i, j);
          if (this.solid[idx]) continue;
          const uu = this.u[idx] * 15;
          const vv = this.v[idx] * 15;
          const x = i * scaleX, y = j * scaleY;
          const len = Math.sqrt(uu * uu + vv * vv);
          if (len > 0.3) {
            drawArrow(ctx, x, y, x + uu, y + vv, 'rgba(255,255,150,0.4)', 1, 3);
          }
        }
      }
    }

    // Info panel
    const infoX = 14;
    const infoY = height - 70;
    ctx.save();
    ctx.fillStyle = 'rgba(9,9,11,0.8)';
    ctx.beginPath();
    ctx.roundRect(infoX - 6, infoY - 16, 230, 80, 6);
    ctx.fill();
    ctx.restore();

    drawText(ctx, `Re = ${this.Re.toFixed(0)}`, infoX, infoY, '#e2e8f0', 'bold 14px system-ui');
    const reDesc = this.Re < 40 ? 'Steady attached' : this.Re < 150 ? 'Laminar vortex street' : this.Re < 300 ? 'Transition' : 'Turbulent wake';
    drawText(ctx, reDesc, infoX, infoY + 20, '#a855f7', '12px system-ui');
    drawText(ctx, `V = ${this.freestreamVel.toFixed(2)} m/s   \u03bd = ${this.viscosity.toFixed(5)}`, infoX, infoY + 40, '#64748b', '12px system-ui');
    drawText(ctx, `t = ${this.time.toFixed(2)}s`, infoX, infoY + 58, '#475569', '11px system-ui');
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'freestreamVel', label: 'Freestream Velocity', min: 0.5, max: 5, step: 0.1, defaultValue: 1.5 },
      { type: 'slider', key: 'viscosity', label: 'Viscosity', min: 0.0001, max: 0.005, step: 0.0001, defaultValue: 0.0003 },
      { type: 'toggle', key: 'showVelocity', label: 'Velocity Field', defaultValue: false },
      { type: 'toggle', key: 'colorByVorticity', label: 'Color by Vorticity', defaultValue: true },
      { type: 'button', key: 'injectDye', label: 'Inject Dye Pulse' },
      { type: 'button', key: 'reset', label: 'Reset' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      freestreamVel: this.freestreamVel,
      viscosity: this.viscosity,
      showVelocity: this.showVelocity,
      colorByVorticity: this.colorByVorticity,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'freestreamVel':
        this.freestreamVel = value as number;
        this.computeRe();
        break;
      case 'viscosity':
        this.viscosity = value as number;
        this.computeRe();
        break;
      case 'showVelocity': this.showVelocity = value as boolean; break;
      case 'colorByVorticity': this.colorByVorticity = value as boolean; break;
      case 'injectDye': this.dyePulse = 3; break;
      case 'reset': this.reset(); break;
    }
  }
}

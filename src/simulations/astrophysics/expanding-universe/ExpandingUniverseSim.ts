import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawText, clearCanvas, drawDashedLine, drawGrid } from '@/engine/render/drawUtils.ts';

interface Galaxy {
  /** Comoving coordinates (fixed) */
  cx: number;
  cy: number;
  size: number;
  color: string;
}

export default class ExpandingUniverseSim extends SimulationEngine {
  private omegaM = 0.3;
  private omegaL = 0.7;
  private showParticleHorizon = false;
  private showHubbleSphere = true;
  private preset = 'lcdm';

  // Computed scale-factor curve
  private aOfT: { t: number; a: number }[] = [];
  private currentStep = 0;
  private animating = true;

  // Galaxy grid for visualization
  private galaxies: Galaxy[] = [];

  // Layout
  private plotLeft = 60;
  private plotTop = 30;
  private plotRight = 0;
  private plotMidY = 0; // bottom of a(t) plot
  private galaxyPanelTop = 0;
  private galaxyPanelBottom = 0;

  private readonly GALAXY_COLORS = [
    '#a78bfa', '#818cf8', '#60a5fa', '#38bdf8', '#34d399',
    '#fbbf24', '#fb923c', '#f87171', '#e879f9', '#94a3b8',
  ];

  setup(): void {
    this.layoutPanels();
    this.generateGalaxies();
    this.solveScaleFactor();
    this.currentStep = 0;
  }

  private layoutPanels(): void {
    this.plotRight = this.width - 30;
    this.plotMidY = this.height * 0.5;
    this.galaxyPanelTop = this.plotMidY + 25;
    this.galaxyPanelBottom = this.height - 15;
  }

  private generateGalaxies(): void {
    this.galaxies = [];
    const cx = this.width / 2;
    const panelMidY = (this.galaxyPanelTop + this.galaxyPanelBottom) / 2;
    // Grid of comoving galaxies centered on "observer"
    const spacing = 50;
    const cols = Math.ceil(this.width / spacing) + 4;
    const rows = Math.ceil((this.galaxyPanelBottom - this.galaxyPanelTop) / spacing) + 4;
    for (let i = -Math.floor(cols / 2); i <= Math.floor(cols / 2); i++) {
      for (let j = -Math.floor(rows / 2); j <= Math.floor(rows / 2); j++) {
        if (i === 0 && j === 0) continue; // observer
        this.galaxies.push({
          cx: i * spacing,
          cy: j * spacing,
          size: 1.5 + Math.random() * 2.5,
          color: this.GALAXY_COLORS[Math.floor(Math.random() * this.GALAXY_COLORS.length)],
        });
      }
    }
  }

  private get omegaK(): number {
    return 1 - this.omegaM - this.omegaL;
  }

  /**
   * Solve the Friedmann equation numerically using RK4.
   * da/dt = a * H0 * sqrt(Omega_m / a^3 + Omega_Lambda + Omega_k / a^2)
   * We set H0 = 1 (time in units of 1/H0).
   */
  private solveScaleFactor(): void {
    this.aOfT = [];
    const dt = 0.005;
    let a = 0.001; // start near Big Bang
    let t = 0;

    const adot = (a: number): number => {
      const H2 = this.omegaM / (a * a * a) + this.omegaL + this.omegaK / (a * a);
      if (H2 <= 0) return 0;
      return a * Math.sqrt(H2);
    };

    for (let i = 0; i < 800; i++) {
      this.aOfT.push({ t, a });

      // RK4
      const k1 = adot(a);
      const k2 = adot(a + 0.5 * dt * k1);
      const k3 = adot(a + 0.5 * dt * k2);
      const k4 = adot(a + dt * k3);
      const da = (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

      a += da;
      t += dt;

      if (a <= 0.0001 && i > 10) break; // Big Crunch
      if (a > 20) break; // scale factor too large
    }
  }

  /** Get scale factor at current step */
  private currentA(): number {
    if (this.aOfT.length === 0) return 1;
    const idx = Math.min(this.currentStep, this.aOfT.length - 1);
    return this.aOfT[idx].a;
  }

  private currentT(): number {
    if (this.aOfT.length === 0) return 0;
    const idx = Math.min(this.currentStep, this.aOfT.length - 1);
    return this.aOfT[idx].t;
  }

  /** Find index where a ~ 1 (present epoch) */
  private presentEpochIdx(): number {
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < this.aOfT.length; i++) {
      const d = Math.abs(this.aOfT[i].a - 1);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  }

  /** Hubble parameter at given scale factor */
  private hubbleParam(a: number): number {
    const H2 = this.omegaM / (a * a * a) + this.omegaL + this.omegaK / (a * a);
    return H2 > 0 ? Math.sqrt(H2) : 0;
  }

  /** Deceleration parameter q = -a * a_ddot / a_dot^2 */
  private decelParam(a: number): number {
    const H = this.hubbleParam(a);
    if (H < 1e-10) return 0;
    // q = Omega_m / (2 a^3 H^2) - Omega_Lambda / H^2
    return this.omegaM / (2 * a * a * a * H * H) - this.omegaL / (H * H);
  }

  /** Determine future fate of the universe */
  private futureFate(): string {
    if (this.omegaL > 0 && this.omegaM + this.omegaL > 1.5) return 'Accelerating Expansion';
    if (this.omegaL > 0) return 'Big Freeze';
    if (this.omegaK < 0) return 'Big Crunch';
    if (Math.abs(this.omegaK) < 0.01 && this.omegaL < 0.01) return 'Coasting (EdS)';
    return 'Eternal Expansion';
  }

  update(dt: number): void {
    this.time += dt;
    if (this.animating && this.aOfT.length > 0) {
      this.currentStep = Math.min(this.currentStep + 1, this.aOfT.length - 1);
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');

    this.renderScaleFactorPlot();
    this.renderGalaxyPanel();
    this.renderInfoPanel();
  }

  private renderScaleFactorPlot(): void {
    const { ctx, width } = this;
    const pL = this.plotLeft;
    const pT = this.plotTop;
    const pR = this.plotRight;
    const pB = this.plotMidY - 10;

    // Plot background
    ctx.fillStyle = '#0c1322';
    ctx.fillRect(pL, pT, pR - pL, pB - pT);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(pL, pT, pR - pL, pB - pT);

    if (this.aOfT.length < 2) return;

    // Determine axis ranges
    const tMax = this.aOfT[this.aOfT.length - 1].t;
    let aMax = 0;
    for (const pt of this.aOfT) aMax = Math.max(aMax, pt.a);
    aMax = Math.max(aMax, 2) * 1.1;

    const tToX = (t: number) => pL + (t / tMax) * (pR - pL);
    const aToY = (a: number) => pB - (a / aMax) * (pB - pT);

    // Grid
    for (let tg = 0; tg <= tMax; tg += Math.max(0.5, Math.round(tMax / 6))) {
      const x = tToX(tg);
      drawDashedLine(ctx, x, pT, x, pB, '#1e293b', 1, [3, 3]);
      drawText(ctx, tg.toFixed(1), x, pB + 12, '#64748b', '9px monospace', 'center');
    }
    for (let ag = 0; ag <= aMax; ag += Math.max(0.5, Math.round(aMax / 5))) {
      const y = aToY(ag);
      drawDashedLine(ctx, pL, y, pR, y, '#1e293b', 1, [3, 3]);
      drawText(ctx, ag.toFixed(1), pL - 5, y, '#64748b', '9px monospace', 'right');
    }

    // a = 1 reference line (present epoch)
    if (1 < aMax) {
      const y1 = aToY(1);
      drawDashedLine(ctx, pL, y1, pR, y1, '#f59e0b30', 1, [6, 4]);
      drawText(ctx, 'a=1 (now)', pR - 5, y1 - 8, '#f59e0b60', '9px monospace', 'right');
    }

    // Scale factor curve
    ctx.beginPath();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    for (let i = 0; i < this.aOfT.length; i++) {
      const x = tToX(this.aOfT[i].t);
      const y = aToY(this.aOfT[i].a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Highlight traversed portion
    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    const limit = Math.min(this.currentStep, this.aOfT.length - 1);
    for (let i = 0; i <= limit; i++) {
      const x = tToX(this.aOfT[i].t);
      const y = aToY(this.aOfT[i].a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Current position marker
    const curT = this.currentT();
    const curA = this.currentA();
    const mx = tToX(curT);
    const my = aToY(curA);

    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 12);
    glow.addColorStop(0, '#22d3ee80');
    glow.addColorStop(1, '#22d3ee00');
    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();

    // Mark Big Bang
    const bbx = tToX(0);
    drawText(ctx, 'Big Bang', bbx + 5, pT + 12, '#ef4444', '10px system-ui', 'left');

    // Mark present epoch
    const peIdx = this.presentEpochIdx();
    if (peIdx > 0 && peIdx < this.aOfT.length) {
      const px = tToX(this.aOfT[peIdx].t);
      const py = aToY(this.aOfT[peIdx].a);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      drawText(ctx, 'Now', px + 6, py - 6, '#f59e0b', '9px system-ui', 'left');
    }

    // Future fate label
    const fate = this.futureFate();
    drawText(ctx, fate, pR - 5, pT + 12, '#a855f7', '10px system-ui', 'right');

    // Axis labels
    drawText(ctx, 'Time (1/H_0)', (pL + pR) / 2, pB + 22, '#94a3b8', '11px system-ui', 'center');
    ctx.save();
    ctx.translate(15, (pT + pB) / 2);
    ctx.rotate(-Math.PI / 2);
    drawText(ctx, 'Scale Factor a(t)', 0, 0, '#94a3b8', '11px system-ui', 'center');
    ctx.restore();

    drawText(ctx, 'Scale Factor Evolution', (pL + pR) / 2, pT - 8, '#e2e8f0', 'bold 12px system-ui', 'center');
  }

  private renderGalaxyPanel(): void {
    const { ctx, width } = this;
    const top = this.galaxyPanelTop;
    const bot = this.galaxyPanelBottom;
    const panelCx = width / 2;
    const panelCy = (top + bot) / 2;

    // Panel background
    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, top, width, bot - top);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width, top);
    ctx.stroke();

    const a = this.currentA();

    // Hubble sphere
    if (this.showHubbleSphere) {
      const H = this.hubbleParam(a);
      const hubbleR = H > 0.01 ? Math.min((1 / H) * 40, 300) : 300;
      ctx.beginPath();
      ctx.arc(panelCx, panelCy, hubbleR, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b30';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, 'Hubble sphere', panelCx + hubbleR + 5, panelCy - 5, '#f59e0b50', '9px system-ui', 'left');
    }

    // Particle horizon
    if (this.showParticleHorizon) {
      // Approximate particle horizon as integral of c/a over time
      const horizonR = Math.min(this.currentT() * 60, 350);
      ctx.beginPath();
      ctx.arc(panelCx, panelCy, horizonR, 0, Math.PI * 2);
      ctx.strokeStyle = '#a855f730';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, 'Particle horizon', panelCx - horizonR - 5, panelCy - 5, '#a855f750', '9px system-ui', 'right');
    }

    // Observer at center
    ctx.beginPath();
    ctx.arc(panelCx, panelCy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(panelCx, panelCy, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#22d3ee40';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Galaxies expanding outward
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, width, bot - top);
    ctx.clip();

    for (const g of this.galaxies) {
      const gx = panelCx + g.cx * a;
      const gy = panelCy + g.cy * a;
      if (gx < -10 || gx > width + 10 || gy < top - 10 || gy > bot + 10) continue;

      // Galaxy dot
      ctx.beginPath();
      ctx.arc(gx, gy, g.size, 0, Math.PI * 2);
      ctx.fillStyle = g.color + '90';
      ctx.fill();

      // Small glow for bigger galaxies
      if (g.size > 2.5) {
        const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, g.size * 3);
        gl.addColorStop(0, g.color + '20');
        gl.addColorStop(1, g.color + '00');
        ctx.beginPath();
        ctx.fillStyle = gl;
        ctx.arc(gx, gy, g.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    drawText(ctx, 'Expanding Galaxy Distribution', width / 2, top + 12, '#94a3b8', '10px system-ui', 'center');
  }

  private renderInfoPanel(): void {
    const { ctx, width } = this;
    const a = this.currentA();
    const H = this.hubbleParam(a);
    const q = this.decelParam(a);
    const t = this.currentT();

    // Overlay in top-right
    const px = width - 10;
    const py = this.plotTop + 5;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(px - 200, py, 200, 100);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 200, py, 200, 100);

    drawText(ctx, `a(t) = ${a.toFixed(3)}`, px - 10, py + 14, '#22d3ee', '11px monospace', 'right');
    drawText(ctx, `H = ${H.toFixed(3)} H_0`, px - 10, py + 30, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `q = ${q.toFixed(3)}`, px - 10, py + 46, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Omega_k = ${this.omegaK.toFixed(2)}`, px - 10, py + 62, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `t = ${t.toFixed(2)} / H_0`, px - 10, py + 78, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, this.futureFate(), px - 10, py + 94, '#a855f7', '10px system-ui', 'right');
  }

  reset(): void {
    this.currentStep = 0;
    this.animating = true;
    this.time = 0;
    this.solveScaleFactor();
  }

  resize(w: number, h: number, pr: number): void {
    super.resize(w, h, pr);
    this.layoutPanels();
    this.generateGalaxies();
  }

  private applyPreset(name: string): void {
    switch (name) {
      case 'eds':
        this.omegaM = 1.0; this.omegaL = 0.0; break;
      case 'lcdm':
        this.omegaM = 0.3; this.omegaL = 0.7; break;
      case 'open':
        this.omegaM = 0.3; this.omegaL = 0.0; break;
      case 'closed':
        this.omegaM = 2.0; this.omegaL = 0.0; break;
      case 'de-sitter':
        this.omegaM = 0.0; this.omegaL = 1.0; break;
    }
    this.currentStep = 0;
    this.animating = true;
    this.solveScaleFactor();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'omegaM', label: 'Matter Density (Omega_m)', min: 0, max: 2, step: 0.05, defaultValue: 0.3 },
      { type: 'slider', key: 'omegaL', label: 'Dark Energy (Omega_Lambda)', min: 0, max: 2, step: 0.05, defaultValue: 0.7 },
      { type: 'toggle', key: 'showParticleHorizon', label: 'Particle Horizon', defaultValue: false },
      { type: 'toggle', key: 'showHubbleSphere', label: 'Hubble Sphere', defaultValue: true },
      {
        type: 'dropdown', key: 'preset', label: 'Model Preset',
        options: [
          { value: 'lcdm', label: 'Lambda-CDM' },
          { value: 'eds', label: 'Einstein-de Sitter' },
          { value: 'open', label: 'Open Universe' },
          { value: 'closed', label: 'Closed Universe' },
          { value: 'de-sitter', label: 'de Sitter' },
        ],
        defaultValue: 'lcdm',
      },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      omegaM: this.omegaM,
      omegaL: this.omegaL,
      showParticleHorizon: this.showParticleHorizon,
      showHubbleSphere: this.showHubbleSphere,
      preset: this.preset,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'omegaM':
        this.omegaM = value as number;
        this.currentStep = 0;
        this.solveScaleFactor();
        break;
      case 'omegaL':
        this.omegaL = value as number;
        this.currentStep = 0;
        this.solveScaleFactor();
        break;
      case 'showParticleHorizon': this.showParticleHorizon = value as boolean; break;
      case 'showHubbleSphere': this.showHubbleSphere = value as boolean; break;
      case 'preset':
        this.preset = value as string;
        this.applyPreset(this.preset);
        break;
    }
  }
}

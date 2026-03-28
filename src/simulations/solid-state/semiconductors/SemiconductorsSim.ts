import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText } from '@/engine/render/drawUtils.ts';

type DopingType = 'intrinsic' | 'n-type' | 'p-type';

interface Carrier {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isElectron: boolean; // true = electron in conduction band, false = hole in valence band
}

const kB = 8.617e-5; // Boltzmann constant in eV/K

export default class SemiconductorsSim extends SimulationEngine {
  private temperature = 300;
  private bandGap = 1.1;
  private doping: DopingType = 'intrinsic';

  private carriers: Carrier[] = [];
  private animTime = 0;

  // Band diagram layout (set in setup/resize)
  private bandLeft = 0;
  private bandRight = 0;
  private bandTop = 0;
  private bandBottom = 0;
  private valenceTop = 0;
  private conductionBottom = 0;

  setup(): void {
    this.computeLayout();
    this.populateCarriers();
  }

  private computeLayout(): void {
    const margin = 60;
    this.bandLeft = margin + 40;
    this.bandRight = this.width * 0.6;
    this.bandTop = margin;
    this.bandBottom = this.height - margin;

    const totalEnergy = 4.0; // eV range displayed
    const pxPerEv = (this.bandBottom - this.bandTop) / totalEnergy;
    const midY = (this.bandTop + this.bandBottom) / 2;

    this.conductionBottom = midY - (this.bandGap / 2) * pxPerEv;
    this.valenceTop = midY + (this.bandGap / 2) * pxPerEv;
  }

  private fermiLevel(): number {
    // Returns Fermi level position as fraction from valence band top (0) to conduction band bottom (1)
    if (this.doping === 'n-type') return 0.8;
    if (this.doping === 'p-type') return 0.2;
    return 0.5; // intrinsic: midgap
  }

  private carrierConcentration(): { n: number; p: number } {
    const T = Math.max(this.temperature, 1);
    const kT = kB * T;
    const ni = 1e10 * Math.exp(-this.bandGap / (2 * kT) + 1.1 / (2 * kB * 300)); // normalized to Si at 300K

    if (this.doping === 'n-type') {
      const Nd = 1e16;
      const n = Nd;
      const p = (ni * ni) / n;
      return { n, p };
    }
    if (this.doping === 'p-type') {
      const Na = 1e16;
      const p = Na;
      const n = (ni * ni) / p;
      return { n, p };
    }
    return { n: ni, p: ni };
  }

  private conductivity(): number {
    const { n, p } = this.carrierConcentration();
    const mu_e = 1400; // cm^2/Vs for Si electrons
    const mu_h = 450;  // cm^2/Vs for Si holes
    const q = 1.6e-19;
    return q * (n * mu_e + p * mu_h);
  }

  private populateCarriers(): void {
    this.carriers = [];
    const T = this.temperature;
    const kT = kB * Math.max(T, 1);

    // Number of electrons excited to conduction band (visual, not physical)
    const excitationProb = Math.min(1, Math.exp(-this.bandGap / (2 * kT) + 1.1 / (2 * kB * 300)));
    let numElectrons = Math.floor(excitationProb * 30);

    if (this.doping === 'n-type') numElectrons = Math.max(numElectrons, 12);
    if (this.doping === 'p-type') numElectrons = Math.max(numElectrons, 2);

    let numHoles = numElectrons;
    if (this.doping === 'n-type') numHoles = Math.max(1, Math.floor(numElectrons * 0.15));
    if (this.doping === 'p-type') { numHoles = Math.max(numElectrons, 12); numElectrons = Math.max(1, Math.floor(numHoles * 0.15)); }

    const bw = this.bandRight - this.bandLeft;

    for (let i = 0; i < numElectrons; i++) {
      this.carriers.push({
        x: this.bandLeft + Math.random() * bw,
        y: this.conductionBottom - 10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 15,
        isElectron: true,
      });
    }

    for (let i = 0; i < numHoles; i++) {
      this.carriers.push({
        x: this.bandLeft + Math.random() * bw,
        y: this.valenceTop + 10 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 10,
        isElectron: false,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.animTime += dt;

    const bw = this.bandRight - this.bandLeft;

    for (const c of this.carriers) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Bounce within band region
      if (c.x < this.bandLeft) { c.x = this.bandLeft; c.vx = Math.abs(c.vx); }
      if (c.x > this.bandRight) { c.x = this.bandRight; c.vx = -Math.abs(c.vx); }

      if (c.isElectron) {
        if (c.y > this.conductionBottom - 5) { c.y = this.conductionBottom - 5; c.vy = -Math.abs(c.vy); }
        if (c.y < this.bandTop + 5) { c.y = this.bandTop + 5; c.vy = Math.abs(c.vy); }
      } else {
        if (c.y < this.valenceTop + 5) { c.y = this.valenceTop + 5; c.vy = Math.abs(c.vy); }
        if (c.y > this.bandBottom - 5) { c.y = this.bandBottom - 5; c.vy = -Math.abs(c.vy); }
      }

      // Random scattering
      if (Math.random() < 0.02) {
        c.vx += (Math.random() - 0.5) * 20;
        c.vy += (Math.random() - 0.5) * 10;
      }
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    const bl = this.bandLeft;
    const br = this.bandRight;
    const bw = br - bl;

    // Conduction band (top region)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fillRect(bl, this.bandTop, bw, this.conductionBottom - this.bandTop);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bl, this.conductionBottom);
    ctx.lineTo(br, this.conductionBottom);
    ctx.stroke();
    drawText(ctx, 'Conduction Band (E_c)', bl + bw / 2, this.bandTop + 15, '#ef4444', '11px system-ui', 'center');

    // Valence band (bottom region)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.fillRect(bl, this.valenceTop, bw, this.bandBottom - this.valenceTop);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bl, this.valenceTop);
    ctx.lineTo(br, this.valenceTop);
    ctx.stroke();
    drawText(ctx, 'Valence Band (E_v)', bl + bw / 2, this.bandBottom - 10, '#3b82f6', '11px system-ui', 'center');

    // Band gap label
    const gapMidY = (this.conductionBottom + this.valenceTop) / 2;
    ctx.fillStyle = 'rgba(15,23,42,0.6)';
    ctx.fillRect(bl, this.conductionBottom, bw, this.valenceTop - this.conductionBottom);
    drawText(ctx, `E_g = ${this.bandGap.toFixed(2)} eV`, bl + bw / 2, gapMidY, '#94a3b8', '12px monospace', 'center');

    // Fermi level
    const ef = this.fermiLevel();
    const efY = this.valenceTop - ef * (this.valenceTop - this.conductionBottom);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bl - 10, efY);
    ctx.lineTo(br + 10, efY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawText(ctx, 'E_F', br + 15, efY, '#22c55e', '11px monospace', 'left');

    // Doping levels
    if (this.doping === 'n-type') {
      const donorY = this.conductionBottom + (this.valenceTop - this.conductionBottom) * 0.15;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bl + 20, donorY);
      ctx.lineTo(br - 20, donorY);
      ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, 'Donor level (E_d)', br - 20, donorY - 10, '#f59e0b', '10px system-ui', 'right');
    }

    if (this.doping === 'p-type') {
      const acceptorY = this.valenceTop - (this.valenceTop - this.conductionBottom) * 0.15;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bl + 20, acceptorY);
      ctx.lineTo(br - 20, acceptorY);
      ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, 'Acceptor level (E_a)', br - 20, acceptorY + 14, '#a855f7', '10px system-ui', 'right');
    }

    // Energy axis label
    drawText(ctx, 'Energy (eV)', bl - 35, (this.bandTop + this.bandBottom) / 2, '#64748b', '11px system-ui', 'center');

    // Draw carriers
    for (const c of this.carriers) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      if (c.isElectron) {
        ctx.fillStyle = '#f87171';
        ctx.fill();
        ctx.strokeStyle = '#fca5a5';
      } else {
        // Holes drawn as open circles
        ctx.fillStyle = 'transparent';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
      }
      ctx.stroke();

      // Label for holes
      if (!c.isElectron) {
        drawText(ctx, '+', c.x, c.y, '#60a5fa', '8px monospace', 'center');
      } else {
        drawText(ctx, '-', c.x, c.y + 1, '#fca5a5', '8px monospace', 'center');
      }
    }

    // Fermi-Dirac distribution curve on the right side
    const fdLeft = this.width * 0.65;
    const fdRight = this.width - 20;
    const fdW = fdRight - fdLeft;
    const fdTop = this.bandTop;
    const fdBottom = this.bandBottom;

    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(fdLeft - 10, fdTop - 10, fdW + 30, fdBottom - fdTop + 20);

    drawText(ctx, 'Fermi-Dirac', fdLeft + fdW / 2, fdTop + 5, '#e2e8f0', '11px system-ui', 'center');
    drawText(ctx, 'Distribution', fdLeft + fdW / 2, fdTop + 20, '#e2e8f0', '11px system-ui', 'center');

    // Axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fdLeft, fdTop + 30);
    ctx.lineTo(fdLeft, fdBottom);
    ctx.lineTo(fdRight, fdBottom);
    ctx.stroke();

    drawText(ctx, 'f(E)', fdLeft - 5, fdTop + 30, '#64748b', '9px monospace', 'right');
    drawText(ctx, '0', fdLeft - 5, fdBottom, '#64748b', '9px monospace', 'right');
    drawText(ctx, '1', fdLeft - 5, fdTop + 35, '#64748b', '9px monospace', 'right');

    // Draw f(E) curve
    const T = Math.max(this.temperature, 1);
    const kT = kB * T;
    const eRange = 4.0; // eV
    const eMid = this.bandGap / 2; // Fermi level relative to valence band top for intrinsic

    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const E = (1 - frac) * eRange; // energy from bottom to top
      const Ef = this.doping === 'n-type' ? this.bandGap * 0.8
              : this.doping === 'p-type' ? this.bandGap * 0.2
              : this.bandGap * 0.5;
      const f = 1 / (1 + Math.exp((E - Ef) / kT));
      const px = fdLeft + f * (fdW - 10);
      const py = fdBottom - frac * (fdBottom - fdTop - 30);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Info overlay
    const { n, p } = this.carrierConcentration();
    const sigma = this.conductivity();

    const infoX = width - 15;
    const infoY = height - 100;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 250, infoY - 5, 255, 90);
    drawText(ctx, `T = ${this.temperature} K`, infoX, infoY + 10, '#e2e8f0', '11px monospace', 'right');
    drawText(ctx, `n = ${n.toExponential(2)} cm^-3`, infoX, infoY + 28, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `p = ${p.toExponential(2)} cm^-3`, infoX, infoY + 46, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `sigma = ${sigma.toExponential(2)} S/cm`, infoX, infoY + 64, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Doping: ${this.doping}`, infoX, infoY + 82, '#94a3b8', '11px monospace', 'right');
  }

  reset(): void {
    this.time = 0;
    this.animTime = 0;
    this.computeLayout();
    this.populateCarriers();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.computeLayout();
    this.populateCarriers();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'temperature', label: 'Temperature', min: 0, max: 1000, step: 10, defaultValue: 300, unit: 'K' },
      { type: 'slider', key: 'bandGap', label: 'Band Gap', min: 0.5, max: 3.0, step: 0.1, defaultValue: 1.1, unit: 'eV' },
      {
        type: 'dropdown', key: 'doping', label: 'Doping',
        options: [
          { value: 'intrinsic', label: 'Intrinsic' },
          { value: 'n-type', label: 'N-type' },
          { value: 'p-type', label: 'P-type' },
        ],
        defaultValue: 'intrinsic',
      },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      temperature: this.temperature,
      bandGap: this.bandGap,
      doping: this.doping,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'temperature':
        this.temperature = value as number;
        this.computeLayout();
        this.populateCarriers();
        break;
      case 'bandGap':
        this.bandGap = value as number;
        this.computeLayout();
        this.populateCarriers();
        break;
      case 'doping':
        this.doping = value as DopingType;
        this.populateCarriers();
        break;
    }
  }
}

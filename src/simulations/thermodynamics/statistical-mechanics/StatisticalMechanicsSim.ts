import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawArrow, drawGrid, drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

interface AnimParticle {
  level: number;       // current energy level index
  targetLevel: number; // level transitioning to
  x: number;           // visual x position
  y: number;           // visual y position
  targetY: number;     // target y for transition
  transitioning: boolean;
  transProgress: number;
}

export default class StatisticalMechanicsSim extends SimulationEngine {
  private particleCount = 500;
  private temperature = 500;
  private ensemble = 'canonical';
  private showHistogram = true;
  private showOccupation = true;

  // Energy levels
  private readonly numLevels = 20;
  private readonly kB = 1.38e-23;
  private readonly eVtoJ = 1.602e-19;
  private levelEnergies: number[] = []; // in eV
  private levelPopulations: number[] = [];
  private theoreticalPops: number[] = [];

  // Animated particles
  private particles: AnimParticle[] = [];

  // Layout
  private levelsLeft = 0;
  private levelsRight = 0;
  private levelsTop = 0;
  private levelsBottom = 0;

  // Partition function
  private partitionZ = 0;

  // Transition timer
  private transTimer = 0;
  private readonly transInterval = 0.08;

  setup(): void {
    this.computeLayout();
    this.computeLevels();
    this.initParticles();
  }

  private computeLayout(): void {
    this.levelsLeft = 60;
    this.levelsRight = this.width * 0.45;
    this.levelsTop = 70;
    this.levelsBottom = this.height - 60;
  }

  private computeLevels(): void {
    this.levelEnergies = [];
    for (let i = 0; i < this.numLevels; i++) {
      // Energy spacing: linearly spaced, 0 to ~2 eV
      this.levelEnergies.push(i * 0.1);
    }
    this.computeTheoreticalPops();
  }

  private computeTheoreticalPops(): void {
    const kT = this.kB * this.temperature / this.eVtoJ; // kT in eV
    this.partitionZ = 0;
    this.theoreticalPops = [];

    for (let i = 0; i < this.numLevels; i++) {
      const boltzmann = Math.exp(-this.levelEnergies[i] / kT);
      this.theoreticalPops.push(boltzmann);
      this.partitionZ += boltzmann;
    }

    // Normalize
    for (let i = 0; i < this.numLevels; i++) {
      this.theoreticalPops[i] /= this.partitionZ;
    }
  }

  private levelY(level: number): number {
    const frac = level / (this.numLevels - 1);
    return this.levelsBottom - frac * (this.levelsBottom - this.levelsTop);
  }

  private initParticles(): void {
    this.computeTheoreticalPops();
    this.particles = [];
    this.levelPopulations = new Array(this.numLevels).fill(0);

    for (let i = 0; i < this.particleCount; i++) {
      const level = this.sampleBoltzmannLevel();
      this.levelPopulations[level]++;
      const y = this.levelY(level);
      this.particles.push({
        level,
        targetLevel: level,
        x: this.levelsLeft + 30 + Math.random() * (this.levelsRight - this.levelsLeft - 60),
        y: y + (Math.random() - 0.5) * 6,
        targetY: y,
        transitioning: false,
        transProgress: 0,
      });
    }
  }

  private sampleBoltzmannLevel(): number {
    const kT = this.kB * this.temperature / this.eVtoJ;
    // Rejection sampling from Boltzmann distribution
    const weights: number[] = [];
    let total = 0;
    for (let i = 0; i < this.numLevels; i++) {
      const w = Math.exp(-this.levelEnergies[i] / kT);
      weights.push(w);
      total += w;
    }
    let r = Math.random() * total;
    for (let i = 0; i < this.numLevels; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.transTimer += dt;

    // Trigger random transitions
    if (this.transTimer > this.transInterval) {
      this.transTimer = 0;
      const numTransitions = Math.max(1, Math.floor(this.particleCount * 0.02));
      for (let t = 0; t < numTransitions; t++) {
        const idx = Math.floor(Math.random() * this.particles.length);
        const p = this.particles[idx];
        if (p.transitioning) continue;

        const newLevel = this.sampleBoltzmannLevel();
        if (newLevel !== p.level) {
          p.targetLevel = newLevel;
          p.targetY = this.levelY(newLevel);
          p.transitioning = true;
          p.transProgress = 0;
        }
      }
    }

    // Animate transitions
    for (const p of this.particles) {
      if (p.transitioning) {
        p.transProgress += dt * 4;
        if (p.transProgress >= 1) {
          p.transProgress = 1;
          p.transitioning = false;
          this.levelPopulations[p.level]--;
          p.level = p.targetLevel;
          this.levelPopulations[p.level]++;
          p.y = p.targetY + (Math.random() - 0.5) * 6;
        } else {
          // Smooth interpolation with slight arc
          const t = p.transProgress;
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const startY = this.levelY(p.level);
          p.y = startY + (p.targetY - startY) * ease;
          // Horizontal wobble during transition
          p.x += (Math.random() - 0.5) * 2;
        }
      }
    }

    // Keep particles in bounds
    for (const p of this.particles) {
      p.x = Math.max(this.levelsLeft + 15, Math.min(this.levelsRight - 15, p.x));
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50);

    this.renderEnergyLevels();
    this.renderParticles();

    if (this.showHistogram) {
      this.renderHistogram();
    }

    if (this.showOccupation) {
      this.renderOccupationNumbers();
    }

    this.renderInfoPanel();

    // Title
    drawText(ctx, 'Boltzmann Distribution & Statistical Mechanics',
      width / 2, 20, '#e2e8f0', 'bold 14px system-ui', 'center');
    drawText(ctx, `Ensemble: ${this.ensemble}`,
      width / 2, 40, '#a855f7', '11px system-ui', 'center');
  }

  private renderEnergyLevels(): void {
    const { ctx } = this;
    const left = this.levelsLeft;
    const right = this.levelsRight;

    // Energy axis
    drawArrow(ctx, left - 10, this.levelsBottom, left - 10, this.levelsTop - 15, '#64748b', 1.5, 8);
    drawText(ctx, 'E', left - 15, this.levelsTop - 25, '#94a3b8', '13px system-ui', 'center');

    for (let i = 0; i < this.numLevels; i++) {
      const y = this.levelY(i);
      const alpha = 0.15 + 0.85 * (i / (this.numLevels - 1));

      // Level line
      ctx.strokeStyle = `rgba(100, 116, 139, ${0.2 + alpha * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();

      // Energy label
      if (i % 4 === 0 || i === this.numLevels - 1) {
        drawText(ctx, `${this.levelEnergies[i].toFixed(1)} eV`,
          left - 15, y, '#64748b', '9px monospace', 'right');
      }
    }
  }

  private renderParticles(): void {
    const { ctx } = this;

    for (const p of this.particles) {
      // Color by energy level
      const frac = p.level / (this.numLevels - 1);
      const r = Math.round(59 + frac * 196);
      const g = Math.round(130 - frac * 62);
      const b = Math.round(246 - frac * 200);

      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.transitioning
        ? `rgba(251, 191, 36, 0.9)` // gold during transition
        : `rgb(${r},${g},${b})`;
      ctx.fill();
    }
  }

  private renderHistogram(): void {
    const { ctx, width, height } = this;
    const hLeft = this.levelsRight + 30;
    const hRight = width - 30;
    const hWidth = hRight - hLeft;
    const hTop = this.levelsTop;
    const hBottom = this.levelsBottom;

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fillRect(hLeft - 5, hTop - 15, hWidth + 10, hBottom - hTop + 25);

    drawText(ctx, 'Population Distribution', hLeft + hWidth / 2, hTop - 5, '#e2e8f0', '11px system-ui', 'center');

    // Horizontal axis
    drawArrow(ctx, hLeft, hBottom, hRight + 5, hBottom, '#64748b', 1, 6);
    drawText(ctx, 'n_i / N', hRight + 8, hBottom, '#94a3b8', '10px system-ui', 'left');

    const maxPop = Math.max(...this.levelPopulations) / this.particleCount;
    const maxTheo = Math.max(...this.theoreticalPops);
    const maxVal = Math.max(maxPop, maxTheo, 0.01);

    for (let i = 0; i < this.numLevels; i++) {
      const y = this.levelY(i);
      const barHeight = 8;

      // Simulated population (bar)
      const simFrac = this.levelPopulations[i] / this.particleCount;
      const barLen = (simFrac / maxVal) * hWidth * 0.85;
      const frac = i / (this.numLevels - 1);
      const r = Math.round(59 + frac * 196);
      const g = Math.round(130 - frac * 62);
      const b = Math.round(246 - frac * 200);
      ctx.fillStyle = `rgba(${r},${g},${b}, 0.7)`;
      ctx.fillRect(hLeft, y - barHeight / 2, barLen, barHeight);

      // Theoretical line (dot)
      const theoX = hLeft + (this.theoreticalPops[i] / maxVal) * hWidth * 0.85;
      ctx.beginPath();
      ctx.arc(theoX, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();

      // Dashed connector
      if (barLen > 2) {
        drawDashedLine(ctx, hLeft + barLen, y, theoX, y, 'rgba(251,191,36,0.3)', 1, [2, 3]);
      }
    }

    // Legend
    ctx.fillStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.fillRect(hLeft, hBottom + 8, 12, 6);
    drawText(ctx, 'Simulated', hLeft + 16, hBottom + 11, '#94a3b8', '9px system-ui', 'left');

    ctx.beginPath();
    ctx.arc(hLeft + hWidth / 2, hBottom + 11, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    drawText(ctx, 'Boltzmann Theory', hLeft + hWidth / 2 + 8, hBottom + 11, '#94a3b8', '9px system-ui', 'left');
  }

  private renderOccupationNumbers(): void {
    const { ctx } = this;
    const left = this.levelsLeft;
    const right = this.levelsRight;

    for (let i = 0; i < this.numLevels; i++) {
      const y = this.levelY(i);
      const count = this.levelPopulations[i];
      if (count > 0) {
        drawText(ctx, `${count}`, right + 8, y, '#94a3b8', '9px monospace', 'left');
      }
    }
  }

  private renderInfoPanel(): void {
    const { ctx, width } = this;
    const px = width - 15;
    const py = 55;
    const panelW = 230;
    const panelH = 115;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(px - panelW, py, panelW + 5, panelH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - panelW, py, panelW + 5, panelH);

    const kT_eV = this.kB * this.temperature / this.eVtoJ;
    const meanE = this.computeMeanEnergy();
    const entropy = this.computeEntropy();

    drawText(ctx, 'Statistical Properties', px, py + 14, '#f59e0b', 'bold 11px system-ui', 'right');
    drawText(ctx, `T = ${this.temperature} K`, px, py + 32, '#ef4444', '11px monospace', 'right');
    drawText(ctx, `kT = ${(kT_eV * 1000).toFixed(1)} meV`, px, py + 47, '#a855f7', '11px monospace', 'right');
    drawText(ctx, `Z = ${this.partitionZ.toFixed(3)}`, px, py + 62, '#3b82f6', '11px monospace', 'right');
    drawText(ctx, `<E> = ${meanE.toFixed(3)} eV`, px, py + 77, '#22c55e', '11px monospace', 'right');
    drawText(ctx, `S/k = ${entropy.toFixed(3)}`, px, py + 92, '#06b6d4', '11px monospace', 'right');
    drawText(ctx, `N = ${this.particleCount}`, px, py + 107, '#94a3b8', '11px monospace', 'right');
  }

  private computeMeanEnergy(): number {
    let total = 0;
    for (let i = 0; i < this.numLevels; i++) {
      total += this.levelPopulations[i] * this.levelEnergies[i];
    }
    return this.particleCount > 0 ? total / this.particleCount : 0;
  }

  private computeEntropy(): number {
    // S/k = -sum p_i ln(p_i)
    let s = 0;
    for (let i = 0; i < this.numLevels; i++) {
      const p = this.levelPopulations[i] / this.particleCount;
      if (p > 0) {
        s -= p * Math.log(p);
      }
    }
    return s;
  }

  reset(): void {
    this.time = 0;
    this.computeTheoreticalPops();
    this.initParticles();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.computeLayout();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'particleCount', label: 'Particle Count', min: 100, max: 5000, step: 50, defaultValue: 500 },
      { type: 'slider', key: 'temperature', label: 'Temperature', min: 100, max: 10000, step: 50, defaultValue: 500, unit: 'K' },
      {
        type: 'dropdown', key: 'ensemble', label: 'Ensemble Type',
        options: [
          { value: 'microcanonical', label: 'Microcanonical (NVE)' },
          { value: 'canonical', label: 'Canonical (NVT)' },
          { value: 'grand_canonical', label: 'Grand Canonical (\u03BCVT)' },
        ],
        defaultValue: 'canonical',
      },
      { type: 'toggle', key: 'showHistogram', label: 'Energy Histogram', defaultValue: true },
      { type: 'toggle', key: 'showOccupation', label: 'Occupation Numbers', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      particleCount: this.particleCount,
      temperature: this.temperature,
      ensemble: this.ensemble,
      showHistogram: this.showHistogram,
      showOccupation: this.showOccupation,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'particleCount':
        this.particleCount = value as number;
        this.initParticles();
        break;
      case 'temperature':
        this.temperature = value as number;
        this.computeTheoreticalPops();
        // Gradually re-equilibrate rather than hard reset
        break;
      case 'ensemble':
        this.ensemble = value as string;
        break;
      case 'showHistogram':
        this.showHistogram = value as boolean;
        break;
      case 'showOccupation':
        this.showOccupation = value as boolean;
        break;
    }
  }
}

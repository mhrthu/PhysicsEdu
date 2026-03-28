import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

/**
 * Each point on an evolutionary track is defined by:
 * - logT: log10(effective temperature in K)
 * - logL: log10(luminosity in L_sun)
 * - stage: human-readable stage name
 */
interface TrackPoint {
  logT: number;
  logL: number;
  stage: string;
}

/** Spectral-class color from temperature */
function tempToColor(logT: number): string {
  const T = Math.pow(10, logT);
  if (T > 30000) return '#9bb0ff';
  if (T > 10000) return '#aabfff';
  if (T > 7500) return '#cad7ff';
  if (T > 6000) return '#f8f7ff';
  if (T > 5200) return '#fff4ea';
  if (T > 3700) return '#ffd2a1';
  return '#ffcc6f';
}

export default class StellarEvolutionSim extends SimulationEngine {
  private initialMass = 1.0; // solar masses
  private showMainSequenceBand = true;
  private showEvolutionTrack = true;
  private trackProgress = 0; // 0..1 along track
  private animating = false;
  private fastForward = false;

  // HR diagram bounds
  private readonly plotLeft = 80;
  private readonly plotTop = 40;
  private plotRight = 0;
  private plotBottom = 0;

  // Axis ranges
  private readonly logTMin = 3.4; // ~2500 K (right side, cool)
  private readonly logTMax = 4.7; // ~50000 K (left side, hot)
  private readonly logLMin = -4;
  private readonly logLMax = 6;

  setup(): void {
    this.plotRight = this.width - 40;
    this.plotBottom = this.height - 60;
    this.trackProgress = 0;
    this.animating = false;
    this.fastForward = false;
  }

  /** Map log10(T) to x pixel (reversed: hot on left) */
  private logTToX(logT: number): number {
    const frac = (logT - this.logTMin) / (this.logTMax - this.logTMin);
    return this.plotRight - frac * (this.plotRight - this.plotLeft);
  }

  /** Map log10(L) to y pixel (luminous on top) */
  private logLToY(logL: number): number {
    const frac = (logL - this.logLMin) / (this.logLMax - this.logLMin);
    return this.plotBottom - frac * (this.plotBottom - this.plotTop);
  }

  /**
   * Generate evolutionary track for a given initial mass.
   * Simplified but physically motivated stages.
   */
  private getTrack(mass: number): TrackPoint[] {
    const track: TrackPoint[] = [];
    // Main sequence position: L ~ M^3.5, T ~ M^0.57 scaled from solar values
    const logL_ms = 3.5 * Math.log10(mass);
    const logT_ms = Math.log10(5778) + 0.57 * Math.log10(mass);

    // Zero-Age Main Sequence
    track.push({ logT: logT_ms, logL: logL_ms, stage: 'ZAMS' });
    // Terminal Age Main Sequence (slightly cooler, brighter)
    track.push({ logT: logT_ms - 0.03, logL: logL_ms + 0.3, stage: 'TAMS' });

    if (mass < 0.8) {
      // Very low mass: stays on MS essentially forever, slow evolution
      track.push({ logT: logT_ms - 0.05, logL: logL_ms + 0.4, stage: 'Late MS' });
      track.push({ logT: logT_ms - 0.15, logL: logL_ms + 0.2, stage: 'Cooling' });
    } else if (mass < 8) {
      // Sub-giant branch
      track.push({ logT: logT_ms - 0.1, logL: logL_ms + 0.6, stage: 'Sub-giant' });
      // Red Giant Branch
      const rgbLogT = Math.max(3.55, logT_ms - 0.4);
      track.push({ logT: rgbLogT, logL: logL_ms + 1.5, stage: 'RGB Ascent' });
      track.push({ logT: 3.55, logL: logL_ms + 2.5, stage: 'RGB Tip' });

      if (mass > 2) {
        // Horizontal Branch (helium burning)
        track.push({ logT: 3.7, logL: logL_ms + 1.8, stage: 'Horizontal Branch' });
        // AGB
        track.push({ logT: 3.5, logL: logL_ms + 3.0, stage: 'AGB' });
        track.push({ logT: 3.5, logL: logL_ms + 3.5, stage: 'AGB Tip' });
      } else {
        // Helium flash, then HB
        track.push({ logT: 3.7, logL: logL_ms + 1.6, stage: 'He Flash / HB' });
        track.push({ logT: 3.55, logL: logL_ms + 2.0, stage: 'Early AGB' });
      }

      // Planetary nebula phase (rapid move to hot)
      track.push({ logT: 4.0, logL: logL_ms + 2.0, stage: 'Planetary Nebula' });
      track.push({ logT: 4.5, logL: logL_ms + 1.5, stage: 'PN Nucleus' });

      // White dwarf cooling track
      track.push({ logT: 4.3, logL: -1, stage: 'White Dwarf (hot)' });
      track.push({ logT: 4.0, logL: -2.5, stage: 'White Dwarf (cooling)' });
      track.push({ logT: 3.7, logL: -3.5, stage: 'White Dwarf (cool)' });
    } else {
      // Massive star evolution
      // Blue supergiant
      track.push({ logT: logT_ms - 0.05, logL: logL_ms + 0.8, stage: 'Blue Supergiant' });
      // Red Supergiant
      track.push({ logT: 3.6, logL: logL_ms + 1.2, stage: 'Red Supergiant' });
      track.push({ logT: 3.55, logL: logL_ms + 1.5, stage: 'RSG Peak' });

      if (mass > 20) {
        // Blue loop (Wolf-Rayet for very massive)
        track.push({ logT: 4.3, logL: logL_ms + 1.3, stage: 'Blue Loop / WR' });
        track.push({ logT: 3.6, logL: logL_ms + 1.4, stage: 'Return to RSG' });
      }

      // Supernova
      track.push({ logT: 4.0, logL: logL_ms + 4.0, stage: 'Supernova!' });
      // Remnant
      if (mass > 25) {
        track.push({ logT: 4.0, logL: -2, stage: 'Black Hole' });
      } else {
        track.push({ logT: 4.3, logL: -1, stage: 'Neutron Star' });
      }
    }

    return track;
  }

  /** Interpolate along track at fractional progress p in [0,1] */
  private interpolateTrack(track: TrackPoint[], p: number): TrackPoint {
    if (track.length < 2) return track[0];
    const idx = p * (track.length - 1);
    const i = Math.min(Math.floor(idx), track.length - 2);
    const frac = idx - i;
    return {
      logT: track[i].logT + frac * (track[i + 1].logT - track[i].logT),
      logL: track[i].logL + frac * (track[i + 1].logL - track[i].logL),
      stage: frac < 0.5 ? track[i].stage : track[i + 1].stage,
    };
  }

  update(dt: number): void {
    this.time += dt;
    if (this.animating) {
      const speed = this.fastForward ? 0.015 : 0.003;
      this.trackProgress = Math.min(1, this.trackProgress + speed);
      if (this.trackProgress >= 1) this.animating = false;
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');

    const pL = this.plotLeft;
    const pT = this.plotTop;
    const pR = this.plotRight;
    const pB = this.plotBottom;

    // Plot background
    ctx.fillStyle = '#0c1322';
    ctx.fillRect(pL, pT, pR - pL, pB - pT);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(pL, pT, pR - pL, pB - pT);

    // Color-coded temperature gradient along x-axis (subtle)
    for (let x = pL; x < pR; x += 2) {
      const frac = (pR - x) / (pR - pL);
      const logT = this.logTMin + frac * (this.logTMax - this.logTMin);
      const c = tempToColor(logT);
      ctx.fillStyle = c + '08';
      ctx.fillRect(x, pT, 2, pB - pT);
    }

    // Grid lines
    // Temperature grid
    for (let logT = 3.5; logT <= 4.7; logT += 0.1) {
      const x = this.logTToX(logT);
      if (x < pL || x > pR) continue;
      ctx.strokeStyle = logT % 0.5 < 0.01 ? '#1e293b' : '#141c2e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pT);
      ctx.lineTo(x, pB);
      ctx.stroke();

      if (Math.abs(logT % 0.5) < 0.01) {
        const T = Math.pow(10, logT);
        const label = T >= 10000 ? `${(T / 1000).toFixed(0)}kK` : `${T.toFixed(0)}K`;
        drawText(ctx, label, x, pB + 15, '#64748b', '10px monospace', 'center');
      }
    }

    // Luminosity grid
    for (let logL = this.logLMin; logL <= this.logLMax; logL += 1) {
      const y = this.logLToY(logL);
      if (y < pT || y > pB) continue;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pL, y);
      ctx.lineTo(pR, y);
      ctx.stroke();

      const label = logL === 0 ? '1' : logL > 0 ? `10^${logL}` : `10^${logL}`;
      drawText(ctx, label, pL - 8, y, '#64748b', '10px monospace', 'right');
    }

    // Axis labels
    drawText(ctx, 'Temperature (K) -->', width / 2, pB + 38, '#94a3b8', '12px system-ui', 'center');
    drawText(ctx, 'HOT', pL + 10, pB + 38, '#9bb0ff', '10px system-ui', 'left');
    drawText(ctx, 'COOL', pR - 10, pB + 38, '#ffcc6f', '10px system-ui', 'right');

    ctx.save();
    ctx.translate(18, (pT + pB) / 2);
    ctx.rotate(-Math.PI / 2);
    drawText(ctx, 'Luminosity (L_sun)', 0, 0, '#94a3b8', '12px system-ui', 'center');
    ctx.restore();

    // Main Sequence band
    if (this.showMainSequenceBand) {
      ctx.beginPath();
      const msPoints: { x: number; y: number }[] = [];
      for (let m = 0.1; m <= 100; m *= 1.15) {
        const logL = 3.5 * Math.log10(m);
        const logT = Math.log10(5778) + 0.57 * Math.log10(m);
        msPoints.push({ x: this.logTToX(logT), y: this.logLToY(logL) });
      }

      // Draw band (two offset paths)
      const offsets = [0.15, -0.15];
      for (const off of offsets) {
        ctx.beginPath();
        for (let i = 0; i < msPoints.length; i++) {
          const m = 0.1 * Math.pow(1.15, i);
          const logL = 3.5 * Math.log10(m) + off;
          const logT = Math.log10(5778) + 0.57 * Math.log10(m) + off * 0.05;
          const x = this.logTToX(logT);
          const y = this.logLToY(logL);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }

      // Fill the band area
      ctx.beginPath();
      // Upper edge
      for (let m = 0.1; m <= 100; m *= 1.15) {
        const logL = 3.5 * Math.log10(m) + 0.2;
        const logT = Math.log10(5778) + 0.57 * Math.log10(m);
        const x = this.logTToX(logT);
        const y = this.logLToY(logL);
        if (m <= 0.11) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      // Lower edge (reversed)
      for (let m = 100; m >= 0.1; m /= 1.15) {
        const logL = 3.5 * Math.log10(m) - 0.2;
        const logT = Math.log10(5778) + 0.57 * Math.log10(m);
        const x = this.logTToX(logT);
        const y = this.logLToY(logL);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawText(ctx, 'Main Sequence', this.logTToX(3.85) + 15, this.logLToY(1.5), '#3b82f6', '11px system-ui', 'left');
    }

    // Region labels
    drawText(ctx, 'Red Giants', this.logTToX(3.6), this.logLToY(2.5), '#ef444450', '10px system-ui', 'center');
    drawText(ctx, 'Supergiants', this.logTToX(3.7), this.logLToY(4.5), '#f59e0b50', '10px system-ui', 'center');
    drawText(ctx, 'White Dwarfs', this.logTToX(4.1), this.logLToY(-2.5), '#94a3b850', '10px system-ui', 'center');

    // Scatter some representative stars on the MS
    const scatterMasses = [0.3, 0.5, 0.8, 1.0, 1.5, 2.5, 5, 10, 25, 50];
    for (const m of scatterMasses) {
      const logL = 3.5 * Math.log10(m);
      const logT = Math.log10(5778) + 0.57 * Math.log10(m);
      const x = this.logTToX(logT);
      const y = this.logLToY(logL);
      if (x < pL || x > pR || y < pT || y > pB) continue;
      const c = tempToColor(logT);
      const r = 2 + Math.log10(Math.max(m, 0.3)) * 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = c + '60';
      ctx.fill();
    }

    // Evolution track
    if (this.showEvolutionTrack) {
      const track = this.getTrack(this.initialMass);

      // Draw full track as dashed line
      ctx.beginPath();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#f59e0b40';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < track.length; i++) {
        const x = this.logTToX(track[i].logT);
        const y = this.logLToY(track[i].logL);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw traversed portion as solid
      const currentIdx = this.trackProgress * (track.length - 1);
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      for (let i = 0; i <= Math.ceil(currentIdx) && i < track.length; i++) {
        const x = this.logTToX(track[i].logT);
        const y = this.logLToY(track[i].logL);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Track point labels
      for (let i = 0; i < track.length; i++) {
        const x = this.logTToX(track[i].logT);
        const y = this.logLToY(track[i].logL);
        if (x < pL || x > pR || y < pT || y > pB) continue;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b80';
        ctx.fill();
      }

      // Current position dot
      const current = this.interpolateTrack(track, this.trackProgress);
      const cx = this.logTToX(current.logT);
      const cy = this.logLToY(current.logL);

      // Glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15);
      glow.addColorStop(0, tempToColor(current.logT) + '80');
      glow.addColorStop(1, tempToColor(current.logT) + '00');
      ctx.beginPath();
      ctx.fillStyle = glow;
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = tempToColor(current.logT);
      ctx.fill();
      ctx.strokeStyle = '#ffffff60';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Current stellar properties panel
      const T = Math.pow(10, current.logT);
      const L = Math.pow(10, current.logL);
      // Stefan-Boltzmann: R/R_sun = sqrt(L/L_sun) * (T_sun/T)^2
      const R = Math.sqrt(L) * Math.pow(5778 / T, 2);

      const panelX = width - 15;
      const panelY = 15;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(panelX - 210, panelY, 215, 130);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX - 210, panelY, 215, 130);

      drawText(ctx, `M = ${this.initialMass.toFixed(1)} M_sun`, panelX - 5, panelY + 16, '#e2e8f0', 'bold 12px monospace', 'right');
      drawText(ctx, `T_eff = ${T.toFixed(0)} K`, panelX - 5, panelY + 36, '#94a3b8', '11px monospace', 'right');
      drawText(ctx, `L = ${L < 0.01 ? L.toExponential(1) : L.toFixed(L < 10 ? 2 : 0)} L_sun`, panelX - 5, panelY + 54, '#94a3b8', '11px monospace', 'right');
      drawText(ctx, `R = ${R < 0.01 ? R.toExponential(1) : R.toFixed(R < 10 ? 2 : 0)} R_sun`, panelX - 5, panelY + 72, '#94a3b8', '11px monospace', 'right');
      drawText(ctx, `Stage: ${current.stage}`, panelX - 5, panelY + 94, '#f59e0b', '12px system-ui', 'right');

      // Progress bar
      const barX = panelX - 205;
      const barW = 200;
      const barY = panelY + 112;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(barX, barY, barW, 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(barX, barY, barW * this.trackProgress, 6);
    }

    // Title
    drawText(ctx, 'Hertzsprung-Russell Diagram', width / 2, 18, '#e2e8f0', 'bold 14px system-ui', 'center');
  }

  reset(): void {
    this.trackProgress = 0;
    this.animating = false;
    this.fastForward = false;
    this.time = 0;
  }

  resize(w: number, h: number, pr: number): void {
    super.resize(w, h, pr);
    this.plotRight = this.width - 40;
    this.plotBottom = this.height - 60;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'initialMass', label: 'Initial Mass', min: 0.5, max: 50, step: 0.5, defaultValue: 1.0, unit: 'M_sun' },
      { type: 'toggle', key: 'showMainSequenceBand', label: 'Main Sequence Band', defaultValue: true },
      { type: 'toggle', key: 'showEvolutionTrack', label: 'Evolution Track', defaultValue: true },
      { type: 'button', key: 'evolveStep', label: 'Evolve Step' },
      { type: 'button', key: 'fastForward', label: 'Fast Forward' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      initialMass: this.initialMass,
      showMainSequenceBand: this.showMainSequenceBand,
      showEvolutionTrack: this.showEvolutionTrack,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'initialMass':
        this.initialMass = value as number;
        this.trackProgress = 0;
        this.animating = false;
        break;
      case 'showMainSequenceBand': this.showMainSequenceBand = value as boolean; break;
      case 'showEvolutionTrack': this.showEvolutionTrack = value as boolean; break;
      case 'evolveStep':
        this.trackProgress = Math.min(1, this.trackProgress + 0.05);
        break;
      case 'fastForward':
        this.fastForward = !this.fastForward;
        this.animating = true;
        break;
    }
  }
}

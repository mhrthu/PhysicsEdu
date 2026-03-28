import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { clearCanvas, drawText, drawArrow } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

interface StreamParticle {
  x: number;
  y: number;
  streamlineIdx: number;
  t: number; // parametric position along streamline 0-1
}

export default class AirfoilSim extends SimulationEngine {
  // Controls
  private aoa = 5;            // angle of attack degrees
  private airspeed = 40;      // m/s
  private thickness = 12;     // NACA thickness %
  private camber = 2;         // NACA max camber %
  private showStreamlines = true;
  private showPressure = true;
  private showForces = true;

  // Airfoil geometry (computed in setup)
  private upperSurface: Array<{ x: number; y: number }> = [];
  private lowerSurface: Array<{ x: number; y: number }> = [];
  private chordLen = 0;
  private foilCx = 0;
  private foilCy = 0;

  // Streamlines (pre-computed paths in world coords)
  private streamlines: Array<Array<{ x: number; y: number }>> = [];
  private streamParticles: StreamParticle[] = [];

  // Aerodynamic coefficients
  private CL = 0;
  private CD = 0;
  private lift = 0;
  private drag = 0;

  private readonly NUM_STREAMLINES = 20;
  private readonly RHO = 1.225; // kg/m³ air density

  setup(): void {
    this.computeLayout();
    this.computeAirfoil();
    this.computeStreamlines();
    this.initParticles();
    this.computeAero();
    this.time = 0;
  }

  reset(): void {
    this.setup();
  }

  private computeLayout(): void {
    this.chordLen = Math.min(this.width, this.height) * 0.40;
    this.foilCx = this.width * 0.42;
    this.foilCy = this.height * 0.5;
  }

  // NACA 4-digit airfoil profile in chord coordinates [0,1]
  private nacaProfile(numPoints = 100): { upper: Array<{x:number;y:number}>, lower: Array<{x:number;y:number}> } {
    const t = this.thickness / 100;
    const m = this.camber / 100;
    const p = 0.4; // max camber position (fixed at 40%)

    const yt = (x: number) => {
      return (t / 0.2) * (
        0.2969 * Math.sqrt(x) -
        0.1260 * x -
        0.3516 * x * x +
        0.2843 * x * x * x -
        0.1015 * x * x * x * x
      );
    };

    const yc = (x: number) => {
      if (m === 0) return 0;
      if (x < p) return (m / (p * p)) * (2 * p * x - x * x);
      return (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * x - x * x);
    };

    const dyc = (x: number) => {
      if (m === 0) return 0;
      if (x < p) return (2 * m / (p * p)) * (p - x);
      return (2 * m / ((1 - p) * (1 - p))) * (p - x);
    };

    const upper: Array<{x:number;y:number}> = [];
    const lower: Array<{x:number;y:number}> = [];

    for (let i = 0; i <= numPoints; i++) {
      // Cosine spacing for better leading edge resolution
      const beta = (i / numPoints) * Math.PI;
      const x = (1 - Math.cos(beta)) / 2;
      const thickness = yt(x);
      const camberY = yc(x);
      const theta = Math.atan(dyc(x));

      upper.push({
        x: x - thickness * Math.sin(theta),
        y: camberY + thickness * Math.cos(theta),
      });
      lower.push({
        x: x + thickness * Math.sin(theta),
        y: camberY - thickness * Math.cos(theta),
      });
    }

    return { upper, lower };
  }

  private computeAirfoil(): void {
    const { upper, lower } = this.nacaProfile(80);
    this.upperSurface = upper;
    this.lowerSurface = lower;
  }

  // Transform chord-normalized point to screen coords, with AoA rotation
  private toScreen(cx: number, cy: number): { x: number; y: number } {
    const alpha = -this.aoa * Math.PI / 180;
    // Center on chord midpoint (0.25, 0)
    const dx = cx - 0.25;
    const dy = cy;
    const rx = dx * Math.cos(alpha) - dy * Math.sin(alpha);
    const ry = dx * Math.sin(alpha) + dy * Math.cos(alpha);
    return {
      x: this.foilCx + rx * this.chordLen,
      y: this.foilCy - ry * this.chordLen,
    };
  }

  // Simplified velocity field: freestream + doublet approximation for airfoil
  private velocityAt(wx: number, wy: number): { vx: number; vy: number } {
    const V = this.airspeed;
    const alpha = this.aoa * Math.PI / 180;
    // Freestream
    let vx = V * Math.cos(alpha);
    let vy = -V * Math.sin(alpha);

    // Airfoil effect: simplified doublet at chord center
    // Shift to airfoil frame (rotated)
    const px = wx - this.foilCx;
    const py = -(wy - this.foilCy);
    const cosA = Math.cos(-alpha), sinA = Math.sin(-alpha);
    const fx = (px * cosA - py * sinA) / this.chordLen;
    const fy = (px * sinA + py * cosA) / this.chordLen;

    // Distance from chord, scaled
    const r2 = fx * fx + fy * fy;
    if (r2 > 0.01) {
      // Doublet strength proportional to thickness
      const mu = this.thickness / 100 * 0.4;
      // Camber/lift: add circulation (Γ) via thin airfoil theory
      const CL2 = this.CL;
      const gamma = 0.5 * CL2 * V;

      // Doublet perturbation (x-direction dipole)
      const pertVx = mu * (fx * fx - fy * fy) / (r2 * r2);
      const pertVy = mu * (2 * fx * fy) / (r2 * r2);

      // Vortex (circulation) perturbation
      const circVx = -gamma * fy / r2;
      const circVy = gamma * fx / r2;

      // Rotate perturbations back to screen frame
      const totalPertVx = pertVx + circVx;
      const totalPertVy = pertVy + circVy;
      vx += (totalPertVx * cosA - totalPertVy * sinA);
      vy += -(totalPertVx * sinA + totalPertVy * cosA);
    }

    return { vx, vy };
  }

  private computeStreamlines(): void {
    this.streamlines = [];
    const alpha = this.aoa * Math.PI / 180;

    // Place streamlines entering from left at various heights
    const startX = -this.width * 0.45;
    const spread = this.height * 0.45;

    for (let k = 0; k < this.NUM_STREAMLINES; k++) {
      const frac = (k + 0.5) / this.NUM_STREAMLINES;
      const startY = this.foilCy - spread / 2 + frac * spread;

      const line: Array<{ x: number; y: number }> = [];
      let x = this.foilCx + startX;
      let y = startY;
      const dt = 2.5;
      const maxSteps = 400;

      for (let step = 0; step < maxSteps; step++) {
        line.push({ x, y });
        const { vx, vy } = this.velocityAt(x, y);
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed < 0.001) break;
        x += (vx / speed) * dt;
        y += (vy / speed) * dt;
        if (x > this.foilCx + this.width * 0.5 || Math.abs(y - this.foilCy) > this.height * 0.55) break;
      }

      this.streamlines.push(line);
    }
  }

  private initParticles(): void {
    this.streamParticles = [];
    for (let k = 0; k < this.NUM_STREAMLINES; k++) {
      if (this.streamlines[k] && this.streamlines[k].length > 2) {
        this.streamParticles.push({
          x: 0, y: 0,
          streamlineIdx: k,
          t: Math.random(),
        });
      }
    }
  }

  private computeAero(): void {
    // Thin airfoil theory: CL = 2π(α + α_0)
    // Zero-lift angle α₀ ≈ -2*camber for symmetric-ish profiles
    const alpha = this.aoa * Math.PI / 180;
    const alpha0 = -2 * (this.camber / 100) * Math.PI / 10;
    this.CL = 2 * Math.PI * (alpha - alpha0);
    // Drag: induced + profile (simplified)
    this.CD = 0.01 + this.CL * this.CL / (Math.PI * 6);
    const q = 0.5 * this.RHO * this.airspeed * this.airspeed;
    const spanChord = this.chordLen / this.width; // normalized
    this.lift = this.CL * q;
    this.drag = this.CD * q;
  }

  update(dt: number): void {
    const clampedDt = Math.min(dt, 0.05) * this.speed;
    this.computeAero();

    // Advance stream particles along their streamlines
    for (const p of this.streamParticles) {
      const line = this.streamlines[p.streamlineIdx];
      if (!line || line.length < 2) continue;
      // Get current position
      const tIdx = p.t * (line.length - 1);
      const i0 = Math.floor(tIdx);
      const frac = tIdx - i0;
      if (i0 < line.length - 1) {
        p.x = line[i0].x + frac * (line[i0 + 1].x - line[i0].x);
        p.y = line[i0].y + frac * (line[i0 + 1].y - line[i0].y);
      }

      // Speed: faster near airfoil (upper surface) than lower surface
      const isUpper = p.streamlineIdx > this.NUM_STREAMLINES * 0.45;
      const baseSpeed = 0.15;
      const speedMod = isUpper ? 1 + this.CL * 0.3 : Math.max(0.3, 1 - this.CL * 0.2);
      p.t += clampedDt * baseSpeed * speedMod;
      if (p.t > 1) p.t -= 1;
    }

    this.time += clampedDt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#09090b');

    // Recompute layout in case of resize
    this.computeLayout();

    // ---- Draw streamlines ----
    if (this.showStreamlines) {
      ctx.save();
      for (let k = 0; k < this.streamlines.length; k++) {
        const line = this.streamlines[k];
        if (line.length < 2) continue;
        // Color by whether above or below airfoil
        const isUpper = k > this.NUM_STREAMLINES * 0.45 && k < this.NUM_STREAMLINES * 0.55
          ? true : k >= this.NUM_STREAMLINES * 0.55;
        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);
        for (let i = 1; i < line.length; i++) {
          ctx.lineTo(line[i].x, line[i].y);
        }
        ctx.strokeStyle = isUpper ? 'rgba(99,179,237,0.35)' : 'rgba(99,179,237,0.25)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Draw particles on streamlines
      for (const p of this.streamParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(147,210,255,0.8)';
        ctx.fill();
      }
      ctx.restore();
    }

    // ---- Draw airfoil ----
    ctx.save();
    ctx.beginPath();
    const firstUpper = this.toScreen(this.upperSurface[0].x, this.upperSurface[0].y);
    ctx.moveTo(firstUpper.x, firstUpper.y);
    for (let i = 1; i < this.upperSurface.length; i++) {
      const p = this.toScreen(this.upperSurface[i].x, this.upperSurface[i].y);
      ctx.lineTo(p.x, p.y);
    }
    for (let i = this.lowerSurface.length - 1; i >= 0; i--) {
      const p = this.toScreen(this.lowerSurface[i].x, this.lowerSurface[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    const foilGrad = ctx.createLinearGradient(
      this.foilCx - this.chordLen * 0.3,
      this.foilCy - this.chordLen * 0.15,
      this.foilCx + this.chordLen * 0.3,
      this.foilCy + this.chordLen * 0.1
    );
    foilGrad.addColorStop(0, '#334155');
    foilGrad.addColorStop(0.5, '#475569');
    foilGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = foilGrad;
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // ---- Pressure distribution ----
    if (this.showPressure) {
      const alpha = this.aoa * Math.PI / 180;
      const V = this.airspeed;
      const numArrows = 30;

      ctx.save();
      for (let i = 0; i < numArrows; i++) {
        const beta = (i / numArrows) * Math.PI;
        const x = (1 - Math.cos(beta)) / 2;

        for (const [surface, sign] of ([[this.upperSurface, 1], [this.lowerSurface, -1]] as [Array<{x:number;y:number}>, number][])) {
          // Interpolate surface point
          const sLen = surface.length;
          const si = Math.min(sLen - 2, Math.floor(x * (sLen - 1)));
          const sp = surface[si];
          const spn = surface[si + 1] || sp;
          const frac = x * (sLen - 1) - si;
          const sx2 = sp.x + frac * (spn.x - sp.x);
          const sy2 = sp.y + frac * (spn.y - sp.y);

          const screenPt = this.toScreen(sx2, sy2);

          // Cp from thin airfoil theory (simplified sinusoidal distribution)
          const Cp = sign === 1
            ? -this.CL * (1 - x) * 0.8
            : this.CL * (1 - x) * 0.3;

          const arrowLen = Math.abs(Cp) * 25;
          if (arrowLen < 3) continue;

          // Normal direction (rotated by AoA)
          const nx = -Math.sin(alpha) * sign;
          const ny = -Math.cos(alpha) * sign;

          const color = Cp < 0 ? `rgba(59,130,246,0.7)` : `rgba(239,68,68,0.7)`;
          const endX = screenPt.x + nx * arrowLen * (Cp < 0 ? 1 : -1);
          const endY = screenPt.y + ny * arrowLen * (Cp < 0 ? 1 : -1);
          drawArrow(ctx, screenPt.x, screenPt.y, endX, endY, color, 1, 4);
        }
      }
      ctx.restore();
    }

    // ---- Force vectors ----
    if (this.showForces) {
      const alpha = this.aoa * Math.PI / 180;
      const liftScale = Math.min(80, Math.abs(this.lift) * 0.8);
      const dragScale = Math.min(40, Math.abs(this.drag) * 2);
      const fAnchorX = this.foilCx;
      const fAnchorY = this.foilCy - this.chordLen * 0.05;

      // Lift (perpendicular to freestream)
      const liftDirX = Math.sin(alpha);
      const liftDirY = -Math.cos(alpha);
      drawArrow(ctx,
        fAnchorX, fAnchorY,
        fAnchorX + liftDirX * liftScale,
        fAnchorY + liftDirY * liftScale,
        '#22c55e', 3, 10
      );
      drawText(ctx, `L = ${this.lift.toFixed(0)} Pa`, fAnchorX + liftDirX * liftScale + 8, fAnchorY + liftDirY * liftScale, '#22c55e', '13px system-ui');

      // Drag (along freestream)
      drawArrow(ctx,
        fAnchorX, fAnchorY,
        fAnchorX + dragScale, fAnchorY,
        '#ef4444', 2.5, 8
      );
      drawText(ctx, `D = ${this.drag.toFixed(1)} Pa`, fAnchorX + dragScale + 8, fAnchorY, '#ef4444', '12px system-ui');
    }

    // ---- Angle of attack indicator ----
    const alpha = this.aoa * Math.PI / 180;
    const arlX = this.foilCx - this.chordLen * 0.6;
    const arlY = this.foilCy;
    ctx.save();
    ctx.strokeStyle = 'rgba(250,204,21,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(arlX - 40, arlY);
    ctx.lineTo(arlX + 80, arlY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrow(ctx, arlX, arlY, arlX + 60 * Math.cos(-alpha), arlY + 60 * Math.sin(-alpha), '#fbbf24', 1.5, 6);
    ctx.restore();

    // ---- Info panel ----
    const infoX = 14;
    const infoY = height - 100;
    ctx.save();
    ctx.fillStyle = 'rgba(9,9,11,0.8)';
    ctx.beginPath();
    ctx.roundRect(infoX - 6, infoY - 16, 240, 110, 6);
    ctx.fill();
    ctx.restore();

    drawText(ctx, `NACA ${this.camber}${Math.round(this.camber * 10 / 4 % 10)}${String(this.thickness).padStart(2, '0')}`, infoX, infoY, '#e2e8f0', 'bold 13px system-ui');
    drawText(ctx, `AoA = ${this.aoa.toFixed(1)}\u00b0   V = ${this.airspeed} m/s`, infoX, infoY + 20, '#94a3b8', '12px system-ui');
    drawText(ctx, `C\u1d38 = ${this.CL.toFixed(3)}   C\u1d30 = ${this.CD.toFixed(4)}`, infoX, infoY + 40, '#6366f1', '12px system-ui');
    drawText(ctx, `L/D = ${(this.CL / (this.CD + 0.0001)).toFixed(1)}`, infoX, infoY + 60, '#a855f7', '12px system-ui');
    drawText(ctx, `Stall \u2248 15\u00b0 (thin airfoil theory)`, infoX, infoY + 80, 'rgba(148,163,184,0.5)', '11px system-ui');
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'aoa', label: 'Angle of Attack', min: -10, max: 20, step: 0.5, defaultValue: 5, unit: '\u00b0' },
      { type: 'slider', key: 'airspeed', label: 'Airspeed', min: 10, max: 100, step: 1, defaultValue: 40, unit: 'm/s' },
      { type: 'slider', key: 'thickness', label: 'NACA Thickness', min: 6, max: 24, step: 1, defaultValue: 12, unit: '%' },
      { type: 'slider', key: 'camber', label: 'NACA Camber', min: 0, max: 9, step: 0.5, defaultValue: 2, unit: '%' },
      { type: 'toggle', key: 'showStreamlines', label: 'Streamlines', defaultValue: true },
      { type: 'toggle', key: 'showPressure', label: 'Pressure Distribution', defaultValue: true },
      { type: 'toggle', key: 'showForces', label: 'Force Vectors', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      aoa: this.aoa,
      airspeed: this.airspeed,
      thickness: this.thickness,
      camber: this.camber,
      showStreamlines: this.showStreamlines,
      showPressure: this.showPressure,
      showForces: this.showForces,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    const needsRecompute = ['aoa', 'airspeed', 'thickness', 'camber'].includes(key);
    switch (key) {
      case 'aoa': this.aoa = value as number; break;
      case 'airspeed': this.airspeed = value as number; break;
      case 'thickness': this.thickness = value as number; break;
      case 'camber': this.camber = value as number; break;
      case 'showStreamlines': this.showStreamlines = value as boolean; break;
      case 'showPressure': this.showPressure = value as boolean; break;
      case 'showForces': this.showForces = value as boolean; break;
    }
    if (needsRecompute) {
      this.computeAero();
      this.computeLayout();
      this.computeAirfoil();
      this.computeStreamlines();
      this.initParticles();
    }
  }
}

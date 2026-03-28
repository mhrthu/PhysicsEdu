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

  // Potential flow: uniform + doublet + vortex (cylinder with circulation)
  // Reference: Vr = U cos(θ)(1 - R²/r²), Vθ = -U sin(θ)(1 + R²/r²) - Γ/(2πr)
  // https://eng.libretexts.org/Bookshelves/Civil_Engineering/Fluid_Mechanics_(Bar-Meir)/10.3.1.1
  private velocityAt(wx: number, wy: number): { vx: number; vy: number } {
    const U = this.airspeed;
    const alpha = this.aoa * Math.PI / 180;

    // Position relative to airfoil center, in physical coords (y UP)
    const dx = wx - this.foilCx;
    const dy = -(wy - this.foilCy); // screen y-down → physics y-up

    // Rotate into airfoil frame (aligned with chord)
    const cosA = Math.cos(alpha), sinA = Math.sin(alpha);
    const ax = dx * cosA + dy * sinA;   // along chord
    const ay = -dx * sinA + dy * cosA;  // perpendicular (+ = above)

    // Polar coords in airfoil frame (normalized by chord)
    let r = Math.sqrt(ax * ax + ay * ay) / this.chordLen;
    const theta = Math.atan2(ay, ax);

    // Effective cylinder radius must match the rendered airfoil size
    // NACA max thickness at 30% chord ≈ thickness/100 * 0.5 (half-height)
    // Add margin so streamlines stay outside the drawn shape
    const tRatio = this.thickness / 100;
    const R = tRatio * 0.55 + 0.04; // half-thickness + margin

    // If inside the body, clamp to surface — prevents streamlines entering
    if (r < R * 1.01) r = R * 1.01;

    // Circulation: positive Γ = counterclockwise = faster on top = lift
    const Gamma = this.CL * U * 0.12;

    const R2 = R * R;
    const r2 = r * r;

    // Standard potential flow (textbook formulas):
    // Vr = U cos(θ) (1 - R²/r²)
    const Vr = U * Math.cos(theta) * (1 - R2 / r2);
    // Vθ = -U sin(θ) (1 + R²/r²) - Γ/(2πr)
    const Vt = -U * Math.sin(theta) * (1 + R2 / r2) - Gamma / (2 * Math.PI * r);

    // Polar → Cartesian in airfoil frame
    const vx_af = Vr * Math.cos(theta) - Vt * Math.sin(theta);
    const vy_af = Vr * Math.sin(theta) + Vt * Math.cos(theta);

    // Rotate back to physical frame
    const vx_phys = vx_af * cosA - vy_af * sinA;
    const vy_phys = vx_af * sinA + vy_af * cosA;

    // Physical → screen coords (flip y back)
    return { vx: vx_phys, vy: -vy_phys };
  }

  // Get the airfoil upper/lower surface y in screen coords at a given screen x
  private getAirfoilBoundsAtX(screenX: number): { upperY: number; lowerY: number; inside: boolean } | null {
    const upperScr = this.upperSurface.map(p => this.toScreen(p.x, p.y));
    const lowerScr = this.lowerSurface.map(p => this.toScreen(p.x, p.y));

    // Find upper surface y at this x (interpolate)
    let upperY = -1, lowerY = -1;
    for (let i = 0; i < upperScr.length - 1; i++) {
      const a = upperScr[i], b = upperScr[i + 1];
      if ((a.x <= screenX && b.x >= screenX) || (b.x <= screenX && a.x >= screenX)) {
        const t = (b.x - a.x) !== 0 ? (screenX - a.x) / (b.x - a.x) : 0;
        upperY = a.y + t * (b.y - a.y);
        break;
      }
    }
    for (let i = 0; i < lowerScr.length - 1; i++) {
      const a = lowerScr[i], b = lowerScr[i + 1];
      if ((a.x <= screenX && b.x >= screenX) || (b.x <= screenX && a.x >= screenX)) {
        const t = (b.x - a.x) !== 0 ? (screenX - a.x) / (b.x - a.x) : 0;
        lowerY = a.y + t * (b.y - a.y);
        break;
      }
    }
    if (upperY < 0 || lowerY < 0) return null;
    return { upperY, lowerY, inside: true };
  }

  private computeStreamlines(): void {
    this.streamlines = [];

    // Get airfoil screen bounds
    const upperScr = this.upperSurface.map(p => this.toScreen(p.x, p.y));
    const lowerScr = this.lowerSurface.map(p => this.toScreen(p.x, p.y));
    const leX = Math.min(...upperScr.map(p => p.x), ...lowerScr.map(p => p.x));
    const teX = Math.max(...upperScr.map(p => p.x), ...lowerScr.map(p => p.x));

    // Stagnation point: moves only slightly below chord center at positive AoA
    // Small shift — most air still splits roughly evenly
    const stagnationY = this.foilCy + this.chordLen * 0.002 * this.aoa;

    const spread = this.height * 0.48;
    const startX = this.foilCx - this.width * 0.42;
    const endX = this.foilCx + this.width * 0.48;
    const dx = 3;

    // Upper: slightly compressed (faster flow = lower pressure = lift)
    // Lower: MORE compressed (air squeezed under the wing by AoA deflection)
    const upperCompression = 0.9;
    const lowerCompression = 0.7; // tighter below — wing pushes air down

    // Transition zone: how far before/after the airfoil the streamlines start bending
    const chordWidth = teX - leX;
    const transitionLen = chordWidth * 1.2; // long gentle approach

    for (let k = 0; k < this.NUM_STREAMLINES; k++) {
      const frac = (k + 0.5) / this.NUM_STREAMLINES;
      const y0 = this.foilCy - spread / 2 + frac * spread;
      const isAbove = y0 < stagnationY;
      const distFromChord = Math.abs(y0 - stagnationY);
      const rank = distFromChord / (spread / 2); // 0 = closest to wing, 1 = farthest
      const influence = Math.max(0, 1 - rank * rank); // far streamlines barely deflect

      const line: Array<{ x: number; y: number }> = [];

      for (let x = startX; x <= endX; x += dx) {
        // Smooth blend: ramps up approaching airfoil, holds over it, ramps down after
        let blend = 0;
        if (x < leX - transitionLen) {
          blend = 0;
        } else if (x < leX) {
          const t = (x - (leX - transitionLen)) / transitionLen;
          blend = t * t * t * (10 - 15 * t + 6 * t * t); // quintic smoothstep
        } else if (x <= teX) {
          blend = 1;
        } else if (x < teX + transitionLen) {
          const t = 1 - (x - teX) / transitionLen;
          blend = t * t * t * (10 - 15 * t + 6 * t * t);
        } else {
          blend = 0;
        }

        let y = y0;
        if (blend > 0.001) {
          const queryX = Math.max(leX + 1, Math.min(teX - 1, x));
          const bounds = this.getAirfoilBoundsAtX(queryX);
          if (bounds) {
            let targetY: number;
            if (isAbove) {
              const offset = (rank * spread * 0.4 * upperCompression) + 8;
              targetY = bounds.upperY - offset;
            } else {
              const offset = (rank * spread * 0.4 * lowerCompression) + 8;
              targetY = bounds.lowerY + offset;
            }
            y = y0 + (targetY - y0) * blend * influence;
          }
        }

        line.push({ x, y });
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
    // Thin airfoil theory: CL = 2π(α - α₀)
    // Zero-lift angle depends on camber
    const alpha = this.aoa * Math.PI / 180;
    const alpha0 = -2 * (this.camber / 100) * Math.PI / 10;
    // Thickness affects max CL via improved leading-edge suction
    const thicknessBoost = 1 + (this.thickness / 100) * 0.5;
    this.CL = 2 * Math.PI * (alpha - alpha0) * thicknessBoost;

    // Drag: profile drag scales with thickness (form drag) + induced drag
    const tRatio = this.thickness / 100;
    const profileCD = 0.006 + 0.12 * tRatio * tRatio; // thicker = more profile drag
    const inducedCD = this.CL * this.CL / (Math.PI * 6); // AR ≈ 6
    this.CD = profileCD + inducedCD;

    const q = 0.5 * this.RHO * this.airspeed * this.airspeed;
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

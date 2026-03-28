import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { clearCanvas, drawText, drawArrow, drawDashedLine } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

interface Particle {
  x: number; // 0-1 normalized along pipe length
  y: number; // 0-1 normalized across pipe height at that section
  phase: number;
}

export default class BernoulliPipeSim extends SimulationEngine {
  // Controls
  private v1 = 2.0;            // inlet velocity m/s
  private constriction = 0.5;  // A2/A1 area ratio
  private density = 1000;      // kg/m³
  private p1 = 150000;         // Pa (150 kPa)
  private showPressureGauges = true;
  private showVelocityArrows = true;
  private showStreamlines = true;

  // Derived physics
  private v2 = 0;
  private p2 = 0;

  // Particles
  private particles: Particle[] = [];
  private readonly NUM_PARTICLES = 60;

  setup(): void {
    this.particles = [];
    for (let i = 0; i < this.NUM_PARTICLES; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        phase: Math.random(),
      });
    }
    this.computePhysics();
  }

  reset(): void {
    this.setup();
    this.time = 0;
  }

  private computePhysics(): void {
    // Continuity: A1*v1 = A2*v2 → v2 = v1 / constriction (since A2 = A1*constriction)
    this.v2 = this.v1 / this.constriction;
    // Bernoulli: p1 + 0.5*rho*v1^2 = p2 + 0.5*rho*v2^2
    this.p2 = this.p1 + 0.5 * this.density * (this.v1 ** 2 - this.v2 ** 2);
  }

  // Returns the half-height of the pipe cross-section at normalized x (0-1)
  // Pipe geometry: wide on left (x<0.25), narrow in middle (0.35<x<0.65), wide on right (x>0.75)
  private pipeHalfHeight(x: number): number {
    const { height } = this;
    const maxH = height * 0.20;  // max pipe half-height
    const minH = maxH * this.constriction;

    // Smooth transition using cosine
    const transition = (t: number) => (1 - Math.cos(t * Math.PI)) / 2;

    if (x < 0.25) return maxH;
    if (x < 0.40) {
      const t = (x - 0.25) / 0.15;
      return maxH - (maxH - minH) * transition(t);
    }
    if (x < 0.60) return minH;
    if (x < 0.75) {
      const t = (x - 0.60) / 0.15;
      return minH + (maxH - minH) * transition(t);
    }
    return maxH;
  }

  private localVelocity(x: number): number {
    const maxH = this.height * 0.20;
    const h = this.pipeHalfHeight(x);
    // By continuity: v * A = const, A proportional to h
    return this.v1 * (maxH / h);
  }

  update(dt: number): void {
    this.computePhysics();
    const clampedDt = Math.min(dt, 0.05) * this.speed;
    const { width } = this;

    for (const p of this.particles) {
      const lv = this.localVelocity(p.x);
      // Scale velocity to screen: pipe length in pixels / v1 gives time to traverse
      const pipeLen = width * 0.85;
      const speed = lv / this.v1 * (this.v1 * 0.05);  // normalized screen speed
      p.x += speed * clampedDt;
      if (p.x > 1) p.x -= 1;
    }

    this.time += clampedDt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#09090b');

    const cx = width / 2;
    const cy = height / 2;
    const pipeLeft = width * 0.05;
    const pipeRight = width * 0.95;
    const pipeLen = pipeRight - pipeLeft;

    // Helper: screen x from normalized x
    const sx = (nx: number) => pipeLeft + nx * pipeLen;
    const halfH = (nx: number) => this.pipeHalfHeight(nx);

    // ---- Draw pipe walls ----
    ctx.save();

    // Build top wall path
    ctx.beginPath();
    const steps = 200;
    ctx.moveTo(sx(0), cy - halfH(0));
    for (let i = 1; i <= steps; i++) {
      const nx = i / steps;
      ctx.lineTo(sx(nx), cy - halfH(nx));
    }
    // Build bottom wall path (right to left)
    for (let i = steps; i >= 0; i--) {
      const nx = i / steps;
      ctx.lineTo(sx(nx), cy + halfH(nx));
    }
    ctx.closePath();

    // Gradient fill for fluid
    const grad = ctx.createLinearGradient(pipeLeft, 0, pipeRight, 0);
    grad.addColorStop(0, 'rgba(30, 80, 180, 0.3)');
    grad.addColorStop(0.4, 'rgba(30, 180, 220, 0.25)');
    grad.addColorStop(0.5, 'rgba(220, 50, 50, 0.3)');
    grad.addColorStop(0.6, 'rgba(30, 180, 220, 0.25)');
    grad.addColorStop(1, 'rgba(30, 80, 180, 0.3)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Pipe walls
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    // Top wall
    ctx.beginPath();
    ctx.moveTo(sx(0), cy - halfH(0));
    for (let i = 1; i <= steps; i++) {
      ctx.lineTo(sx(i / steps), cy - halfH(i / steps));
    }
    ctx.stroke();
    // Bottom wall
    ctx.beginPath();
    ctx.moveTo(sx(0), cy + halfH(0));
    for (let i = 1; i <= steps; i++) {
      ctx.lineTo(sx(i / steps), cy + halfH(i / steps));
    }
    ctx.stroke();

    // Pipe end caps
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(0), cy - halfH(0));
    ctx.lineTo(sx(0), cy + halfH(0));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx(1), cy - halfH(1));
    ctx.lineTo(sx(1), cy + halfH(1));
    ctx.stroke();
    ctx.restore();

    // ---- Streamlines ----
    if (this.showStreamlines) {
      const numLines = 8;
      ctx.save();
      ctx.lineWidth = 1;
      for (let k = 0; k < numLines; k++) {
        const yFrac = (k + 1) / (numLines + 1); // 0..1 across pipe
        ctx.beginPath();
        ctx.moveTo(sx(0), cy + halfH(0) * (2 * yFrac - 1));
        for (let i = 1; i <= steps; i++) {
          const nx = i / steps;
          // streamline y tracks conserved stream function
          // For pipe flow: y_stream / half_height = const (continuity)
          const h0 = halfH(0);
          const h = halfH(nx);
          const streamY = (2 * yFrac - 1) * h;
          ctx.lineTo(sx(nx), cy + streamY);
        }
        const speed = this.localVelocity(0.1);
        const t = Math.min(1, speed / this.v2);
        ctx.strokeStyle = `rgba(100, ${Math.round(150 + t * 100)}, 255, 0.4)`;
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- Particles ----
    ctx.save();
    for (const p of this.particles) {
      const nx = p.x;
      const h = halfH(nx);
      const screenX = sx(nx);
      const screenY = cy + (p.y * 2 - 1) * h * 0.85;
      const lv = this.localVelocity(nx);
      const t = Math.min(1, (lv - this.v1) / (this.v2 - this.v1 + 0.001));
      const r = Math.round(40 + t * 215);
      const g = Math.round(150 - t * 100);
      const b = Math.round(255 - t * 200);
      ctx.beginPath();
      ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }
    ctx.restore();

    // ---- Velocity arrows ----
    if (this.showVelocityArrows) {
      const positions = [0.1, 0.5, 0.9];
      const labels = ['v\u2081', 'v\u2082', 'v\u2081'];
      const values = [this.v1, this.v2, this.v1];
      for (let k = 0; k < 3; k++) {
        const nx = positions[k];
        const arrowLen = Math.min(70, values[k] * 10);
        const ax = sx(nx);
        const ay = cy;
        drawArrow(ctx, ax, ay, ax + arrowLen, ay, '#facc15', 2, 7);
        drawText(ctx, `${labels[k]}=${values[k].toFixed(1)} m/s`, ax + arrowLen + 6, ay, '#facc15', '12px system-ui');
      }
    }

    // ---- Pressure gauges (manometer tubes) ----
    if (this.showPressureGauges) {
      const gaugePositions = [0.1, 0.5, 0.9];
      const pressures = [this.p1, this.p2, this.p1];
      const pMax = this.p1 * 1.1;
      const gaugeH = height * 0.28;
      const gaugeW = 12;

      for (let k = 0; k < 3; k++) {
        const nx = gaugePositions[k];
        const gx = sx(nx);
        const topY = cy - halfH(nx) - 10;
        const tubeTop = topY - gaugeH;
        const p = pressures[k];
        const fillFrac = Math.max(0, Math.min(1, p / pMax));
        const fillH = gaugeH * fillFrac;

        // Tube outline
        ctx.save();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx - gaugeW / 2, tubeTop, gaugeW, gaugeH);

        // Pressure fill
        const col = p > this.p1 * 0.99 ? '#3b82f6' : '#ef4444';
        ctx.fillStyle = col + '99';
        ctx.fillRect(gx - gaugeW / 2, tubeTop + gaugeH - fillH, gaugeW, fillH);

        // Connector line to pipe
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, topY);
        ctx.lineTo(gx, tubeTop + gaugeH);
        ctx.stroke();

        ctx.restore();
        drawText(ctx, `${(p / 1000).toFixed(1)} kPa`, gx, tubeTop - 14, '#e2e8f0', '11px system-ui', 'center');
      }
    }

    // ---- Info panel ----
    const infoX = 14;
    const infoY = height - 80;
    ctx.save();
    ctx.fillStyle = 'rgba(9,9,11,0.75)';
    ctx.beginPath();
    ctx.roundRect(infoX - 6, infoY - 16, 260, 90, 6);
    ctx.fill();
    ctx.restore();

    drawText(ctx, `v\u2081 = ${this.v1.toFixed(2)} m/s   v\u2082 = ${this.v2.toFixed(2)} m/s`, infoX, infoY, '#e2e8f0', '13px system-ui');
    drawText(ctx, `P\u2081 = ${(this.p1 / 1000).toFixed(1)} kPa   P\u2082 = ${(this.p2 / 1000).toFixed(1)} kPa`, infoX, infoY + 20, '#94a3b8', '13px system-ui');
    drawText(ctx, `Q = ${(this.v1 * (halfH(0.1) * 2 / this.height)).toFixed(3)} m\u00b3/s (norm.)`, infoX, infoY + 40, '#64748b', '12px system-ui');
    drawText(ctx, `P + \u00bdρv\u00b2 = ${((this.p1 + 0.5 * this.density * this.v1 ** 2) / 1000).toFixed(1)} kPa`, infoX, infoY + 60, '#6366f1', '12px system-ui');
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'v1', label: 'Flow Velocity v\u2081', min: 0.5, max: 5, step: 0.1, defaultValue: 2.0, unit: 'm/s' },
      { type: 'slider', key: 'constriction', label: 'Constriction Ratio', min: 0.2, max: 0.9, step: 0.05, defaultValue: 0.5 },
      { type: 'slider', key: 'density', label: 'Fluid Density \u03c1', min: 500, max: 1500, step: 50, defaultValue: 1000, unit: 'kg/m\u00b3' },
      { type: 'slider', key: 'p1', label: 'Inlet Pressure P\u2081', min: 100000, max: 200000, step: 5000, defaultValue: 150000, unit: 'Pa' },
      { type: 'toggle', key: 'showPressureGauges', label: 'Pressure Gauges', defaultValue: true },
      { type: 'toggle', key: 'showVelocityArrows', label: 'Velocity Arrows', defaultValue: true },
      { type: 'toggle', key: 'showStreamlines', label: 'Streamlines', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      v1: this.v1,
      constriction: this.constriction,
      density: this.density,
      p1: this.p1,
      showPressureGauges: this.showPressureGauges,
      showVelocityArrows: this.showVelocityArrows,
      showStreamlines: this.showStreamlines,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'v1': this.v1 = value as number; break;
      case 'constriction': this.constriction = value as number; break;
      case 'density': this.density = value as number; break;
      case 'p1': this.p1 = value as number; break;
      case 'showPressureGauges': this.showPressureGauges = value as boolean; break;
      case 'showVelocityArrows': this.showVelocityArrows = value as boolean; break;
      case 'showStreamlines': this.showStreamlines = value as boolean; break;
    }
    this.computePhysics();
  }
}

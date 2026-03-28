import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText, drawArrow } from '@/engine/render/drawUtils.ts';

interface TrackPoint {
  x: number;
  y: number;
}

const TRACK_PRESETS: Record<string, TrackPoint[]> = {
  halfpipe: [
    { x: 0.08, y: 0.3 },
    { x: 0.12, y: 0.75 },
    { x: 0.3, y: 0.85 },
    { x: 0.5, y: 0.85 },
    { x: 0.7, y: 0.85 },
    { x: 0.88, y: 0.75 },
    { x: 0.92, y: 0.3 },
  ],
  valley: [
    { x: 0.05, y: 0.25 },
    { x: 0.25, y: 0.6 },
    { x: 0.5, y: 0.82 },
    { x: 0.75, y: 0.6 },
    { x: 0.95, y: 0.25 },
  ],
  loop: [
    { x: 0.05, y: 0.2 },
    { x: 0.15, y: 0.7 },
    { x: 0.3, y: 0.85 },
    { x: 0.42, y: 0.7 },
    { x: 0.46, y: 0.45 },
    { x: 0.5, y: 0.3 },
    { x: 0.54, y: 0.45 },
    { x: 0.58, y: 0.7 },
    { x: 0.7, y: 0.85 },
    { x: 0.85, y: 0.7 },
    { x: 0.95, y: 0.35 },
  ],
};

export default class EnergySkateParkSim extends SimulationEngine {
  private mass = 2;
  private gravity = 9.8;
  private friction = 0;
  private trackPreset = 'halfpipe';

  private trackPoints: { x: number; y: number }[] = [];
  private ballParam = 0; // 0..1 parametric position along track
  private ballSpeed = 0; // speed along the track
  private thermalEnergy = 0;
  private totalEnergy = 0;

  private draggingBall = false;
  private ballRadius = 12;

  setup(): void {
    this.buildTrack();
    this.ballParam = 0;
    this.ballSpeed = 0;
    this.thermalEnergy = 0;
    const h = this.getTrackHeight(this.ballParam);
    this.totalEnergy = this.mass * this.gravity * h;
  }

  private buildTrack(): void {
    const preset = TRACK_PRESETS[this.trackPreset] || TRACK_PRESETS.halfpipe;
    const rawPoints = preset.map(p => ({
      x: p.x * this.width,
      y: p.y * this.height,
    }));

    // Build smooth track using Catmull-Rom interpolation
    this.trackPoints = [];
    const segments = 200;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = this.catmullRomChain(rawPoints, t);
      this.trackPoints.push(pt);
    }
  }

  private catmullRomChain(points: TrackPoint[], t: number): TrackPoint {
    const n = points.length - 1;
    const scaledT = t * n;
    const i = Math.min(Math.floor(scaledT), n - 1);
    const localT = scaledT - i;

    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[Math.min(i + 1, n)];
    const p3 = points[Math.min(i + 2, n)];

    return {
      x: this.catmullRom(p0.x, p1.x, p2.x, p3.x, localT),
      y: this.catmullRom(p0.y, p1.y, p2.y, p3.y, localT),
    };
  }

  private catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  private getTrackPosition(param: number): TrackPoint {
    const idx = param * (this.trackPoints.length - 1);
    const i = Math.floor(idx);
    const frac = idx - i;
    const a = this.trackPoints[Math.min(i, this.trackPoints.length - 1)];
    const b = this.trackPoints[Math.min(i + 1, this.trackPoints.length - 1)];
    return {
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
    };
  }

  private getTrackHeight(param: number): number {
    const pos = this.getTrackPosition(param);
    // Return height in meters (canvas height = 10m)
    return ((this.height - pos.y) / this.height) * 10;
  }

  private getTrackTangent(param: number): { dx: number; dy: number } {
    const eps = 0.001;
    const p1 = this.getTrackPosition(Math.max(0, param - eps));
    const p2 = this.getTrackPosition(Math.min(1, param + eps));
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { dx: dx / len, dy: dy / len };
  }

  update(dt: number): void {
    if (this.draggingBall) return;
    this.time += dt;

    const h = this.getTrackHeight(this.ballParam);
    const PE = this.mass * this.gravity * h;
    const availableKE = this.totalEnergy - PE - this.thermalEnergy;

    if (availableKE < 0) {
      // Ball has insufficient energy - stop
      this.ballSpeed = 0;
      return;
    }

    const speed = Math.sqrt(2 * availableKE / this.mass);
    const direction = this.ballSpeed >= 0 ? 1 : -1;
    this.ballSpeed = speed * direction;

    // Apply friction
    if (this.friction > 0 && speed > 0.01) {
      const frictionLoss = this.friction * this.mass * this.gravity * speed * dt;
      this.thermalEnergy += frictionLoss;
    }

    // Compute tangent slope to determine gravity acceleration along track
    const tangent = this.getTrackTangent(this.ballParam);
    const gravAccel = this.gravity * tangent.dy; // positive dy means downhill
    this.ballSpeed += gravAccel * dt * 0.02; // scale factor for visual

    // Move along track
    const segLen = 1.0 / this.trackPoints.length;
    const paramSpeed = (this.ballSpeed * dt * 0.1) / (this.width * segLen);
    this.ballParam += paramSpeed;

    // Bounce at endpoints
    if (this.ballParam <= 0) {
      this.ballParam = 0;
      this.ballSpeed = Math.abs(this.ballSpeed);
    }
    if (this.ballParam >= 1) {
      this.ballParam = 1;
      this.ballSpeed = -Math.abs(this.ballSpeed);
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    // Title
    drawText(ctx, 'Energy Skate Park', width / 2, 24, '#e2e8f0', 'bold 16px system-ui', 'center');

    // Draw track
    this.drawTrack();

    // Draw ball
    this.drawBall();

    // Draw energy bar chart
    this.drawEnergyChart();

    // Draw info
    this.drawInfo();
  }

  private drawTrack(): void {
    const { ctx } = this;
    if (this.trackPoints.length < 2) return;

    // Track shadow
    ctx.beginPath();
    ctx.moveTo(this.trackPoints[0].x, this.trackPoints[0].y + 3);
    for (let i = 1; i < this.trackPoints.length; i++) {
      ctx.lineTo(this.trackPoints[i].x, this.trackPoints[i].y + 3);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Track
    ctx.beginPath();
    ctx.moveTo(this.trackPoints[0].x, this.trackPoints[0].y);
    for (let i = 1; i < this.trackPoints.length; i++) {
      ctx.lineTo(this.trackPoints[i].x, this.trackPoints[i].y);
    }
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Track surface highlight
    ctx.beginPath();
    ctx.moveTo(this.trackPoints[0].x, this.trackPoints[0].y);
    for (let i = 1; i < this.trackPoints.length; i++) {
      ctx.lineTo(this.trackPoints[i].x, this.trackPoints[i].y);
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawBall(): void {
    const { ctx } = this;
    const pos = this.getTrackPosition(this.ballParam);
    const bx = pos.x;
    const by = pos.y - this.ballRadius;

    // Shadow
    ctx.beginPath();
    ctx.arc(bx + 2, by + 2, this.ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();

    // Ball
    ctx.beginPath();
    ctx.arc(bx, by, this.ballRadius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(bx - 3, by - 3, 2, bx, by, this.ballRadius);
    grad.addColorStop(0, '#60a5fa');
    grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Velocity vector
    if (Math.abs(this.ballSpeed) > 0.1 && !this.draggingBall) {
      const tangent = this.getTrackTangent(this.ballParam);
      const vScale = Math.min(Math.abs(this.ballSpeed) * 3, 50);
      const dir = this.ballSpeed >= 0 ? 1 : -1;
      drawArrow(ctx, bx, by, bx + tangent.dx * vScale * dir, by + tangent.dy * vScale * dir, '#ef4444', 2, 8);
    }
  }

  private drawEnergyChart(): void {
    const { ctx, height } = this;
    const h = this.getTrackHeight(this.ballParam);
    const PE = this.mass * this.gravity * h;
    const KE = Math.max(0, this.totalEnergy - PE - this.thermalEnergy);
    const total = this.totalEnergy || 1;

    const chartX = 20;
    const chartY = 60;
    const chartW = 30;
    const chartH = height * 0.35;

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.fillRect(chartX - 5, chartY - 20, chartW + 60, chartH + 50);
    ctx.strokeRect(chartX - 5, chartY - 20, chartW + 60, chartH + 50);

    drawText(ctx, 'Energy', chartX + 40, chartY - 8, '#e2e8f0', 'bold 11px system-ui', 'center');

    // Stacked bar
    const keH = (KE / total) * chartH;
    const peH = (PE / total) * chartH;
    const thH = (this.thermalEnergy / total) * chartH;

    // KE (green) at bottom
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(chartX, chartY + chartH - keH, chartW, keH);

    // PE (blue) above KE
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(chartX, chartY + chartH - keH - peH, chartW, peH);

    // Thermal (red) above PE
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(chartX, chartY + chartH - keH - peH - thH, chartW, thH);

    // Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    // Legend
    const lx = chartX + chartW + 6;
    const ly = chartY + 8;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(lx, ly, 8, 8);
    drawText(ctx, 'KE', lx + 12, ly + 4, '#94a3b8', '9px system-ui', 'left');

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(lx, ly + 16, 8, 8);
    drawText(ctx, 'PE', lx + 12, ly + 20, '#94a3b8', '9px system-ui', 'left');

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(lx, ly + 32, 8, 8);
    drawText(ctx, 'Th', lx + 12, ly + 36, '#94a3b8', '9px system-ui', 'left');
  }

  private drawInfo(): void {
    const { ctx, width } = this;
    const h = this.getTrackHeight(this.ballParam);
    const PE = this.mass * this.gravity * h;
    const KE = Math.max(0, this.totalEnergy - PE - this.thermalEnergy);
    const v = Math.sqrt(2 * KE / this.mass);

    const infoX = width - 15;
    const infoY = 50;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const boxW = 200;
    const boxH = 100;
    ctx.fillRect(infoX - boxW, infoY - 5, boxW + 5, boxH);
    ctx.strokeRect(infoX - boxW, infoY - 5, boxW + 5, boxH);

    drawText(ctx, `KE = ${KE.toFixed(1)} J`, infoX, infoY + 12, '#22c55e', '12px monospace', 'right');
    drawText(ctx, `PE = ${PE.toFixed(1)} J`, infoX, infoY + 30, '#3b82f6', '12px monospace', 'right');
    drawText(ctx, `Thermal = ${this.thermalEnergy.toFixed(1)} J`, infoX, infoY + 48, '#ef4444', '12px monospace', 'right');
    drawText(ctx, `Total = ${this.totalEnergy.toFixed(1)} J`, infoX, infoY + 66, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Speed = ${v.toFixed(1)} m/s`, infoX, infoY + 84, '#94a3b8', '11px monospace', 'right');
  }

  reset(): void {
    this.setup();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.buildTrack();
  }

  onPointerDown(x: number, y: number): void {
    if (!this.isRunning()) {
      const pos = this.getTrackPosition(this.ballParam);
      const bx = pos.x;
      const by = pos.y - this.ballRadius;
      const dx = x - bx;
      const dy = y - by;
      if (dx * dx + dy * dy < (this.ballRadius + 10) * (this.ballRadius + 10)) {
        this.draggingBall = true;
      }
    }
  }

  onPointerMove(x: number, _y: number): void {
    if (this.draggingBall) {
      // Find closest point on track
      let bestParam = 0;
      let bestDist = Infinity;
      for (let t = 0; t <= 1; t += 0.005) {
        const pt = this.getTrackPosition(t);
        const d = Math.abs(pt.x - x);
        if (d < bestDist) {
          bestDist = d;
          bestParam = t;
        }
      }
      this.ballParam = bestParam;
      this.ballSpeed = 0;
      this.thermalEnergy = 0;
      const h = this.getTrackHeight(this.ballParam);
      this.totalEnergy = this.mass * this.gravity * h;
    }
  }

  onPointerUp(): void {
    this.draggingBall = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'mass', label: 'Mass', min: 1, max: 10, step: 0.5, defaultValue: 2, unit: 'kg' },
      { type: 'slider', key: 'gravity', label: 'Gravity', min: 1, max: 20, step: 0.1, defaultValue: 9.8, unit: 'm/s\u00B2' },
      { type: 'slider', key: 'friction', label: 'Friction', min: 0, max: 0.5, step: 0.01, defaultValue: 0 },
      {
        type: 'dropdown', key: 'trackPreset', label: 'Track Shape',
        options: [
          { value: 'halfpipe', label: 'Half-Pipe (U)' },
          { value: 'valley', label: 'Valley (V)' },
          { value: 'loop', label: 'Loop' },
        ],
        defaultValue: 'halfpipe',
      },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      mass: this.mass,
      gravity: this.gravity,
      friction: this.friction,
      trackPreset: this.trackPreset,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'mass':
        this.mass = value as number;
        this.recalcTotalEnergy();
        break;
      case 'gravity':
        this.gravity = value as number;
        this.recalcTotalEnergy();
        break;
      case 'friction':
        this.friction = value as number;
        break;
      case 'trackPreset':
        this.trackPreset = value as string;
        this.buildTrack();
        this.ballParam = 0;
        this.ballSpeed = 0;
        this.thermalEnergy = 0;
        this.recalcTotalEnergy();
        break;
    }
  }

  private recalcTotalEnergy(): void {
    const h = this.getTrackHeight(this.ballParam);
    const KE = 0.5 * this.mass * this.ballSpeed * this.ballSpeed;
    this.totalEnergy = this.mass * this.gravity * h + KE + this.thermalEnergy;
  }
}

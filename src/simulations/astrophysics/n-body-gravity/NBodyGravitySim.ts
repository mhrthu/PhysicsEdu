import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawArrow, drawGrid, drawText, clearCanvas } from '@/engine/render/drawUtils.ts';

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  mass: number;
  radius: number;
  color: string;
  trail: { x: number; y: number }[];
}

const BODY_COLORS = [
  '#f59e0b', '#3b82f6', '#ef4444', '#22c55e', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6',
];

const MAX_TRAIL = 400;

export default class NBodyGravitySim extends SimulationEngine {
  private bodies: Body[] = [];
  private G = 1.0;
  private softening = 5;
  private showTrails = true;
  private showCOM = true;
  private preset = 'binary-star';
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragCurrentX = 0;
  private dragCurrentY = 0;
  private colorIndex = 0;

  setup(): void {
    this.loadPreset(this.preset);
  }

  private nextColor(): string {
    const c = BODY_COLORS[this.colorIndex % BODY_COLORS.length];
    this.colorIndex++;
    return c;
  }

  private makeBody(x: number, y: number, vx: number, vy: number, mass: number, color?: string): Body {
    return {
      x, y, vx, vy, ax: 0, ay: 0,
      mass,
      radius: Math.max(3, Math.pow(mass, 0.33) * 3),
      color: color ?? this.nextColor(),
      trail: [],
    };
  }

  private loadPreset(name: string): void {
    this.bodies = [];
    this.colorIndex = 0;
    this.time = 0;
    const cx = this.width / 2;
    const cy = this.height / 2;

    switch (name) {
      case 'binary-star': {
        const sep = 100;
        const v = 1.2;
        this.bodies.push(this.makeBody(cx - sep / 2, cy, 0, -v, 40, '#f59e0b'));
        this.bodies.push(this.makeBody(cx + sep / 2, cy, 0, v, 40, '#3b82f6'));
        break;
      }
      case 'solar-system': {
        this.bodies.push(this.makeBody(cx, cy, 0, 0, 200, '#f59e0b'));
        const planets = [
          { d: 80, m: 2, v: 2.8, c: '#94a3b8' },
          { d: 120, m: 5, v: 2.2, c: '#3b82f6' },
          { d: 170, m: 4, v: 1.8, c: '#ef4444' },
          { d: 230, m: 15, v: 1.5, c: '#f97316' },
          { d: 300, m: 10, v: 1.3, c: '#a855f7' },
        ];
        for (const p of planets) {
          this.bodies.push(this.makeBody(cx + p.d, cy, 0, p.v, p.m, p.c));
        }
        break;
      }
      case 'random-cluster': {
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = 40 + Math.random() * 150;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          const speed = 0.3 + Math.random() * 0.8;
          const vx = -speed * Math.sin(angle) + (Math.random() - 0.5) * 0.3;
          const vy = speed * Math.cos(angle) + (Math.random() - 0.5) * 0.3;
          const mass = 3 + Math.random() * 15;
          this.bodies.push(this.makeBody(x, y, vx, vy, mass));
        }
        break;
      }
      case 'figure-8': {
        // Stable figure-8 three-body solution (Chenciner & Montgomery)
        const s = 100;
        const p1 = { x: -0.97000436, y: 0.24308753 };
        const v3 = { vx: -0.93240737, vy: -0.86473146 };
        const v12 = { vx: -v3.vx / 2, vy: -v3.vy / 2 };
        this.bodies.push(this.makeBody(cx + p1.x * s, cy + p1.y * s, v12.vx, v12.vy, 20, '#f59e0b'));
        this.bodies.push(this.makeBody(cx - p1.x * s, cy - p1.y * s, v12.vx, v12.vy, 20, '#3b82f6'));
        this.bodies.push(this.makeBody(cx, cy, v3.vx, v3.vy, 20, '#ef4444'));
        break;
      }
    }
  }

  private computeAccelerations(): void {
    for (const b of this.bodies) {
      b.ax = 0;
      b.ay = 0;
    }
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i];
        const b = this.bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const r2 = dx * dx + dy * dy + this.softening * this.softening;
        const r = Math.sqrt(r2);
        const F = this.G * a.mass * b.mass / r2;
        const fx = F * dx / r;
        const fy = F * dy / r;
        a.ax += fx / a.mass;
        a.ay += fy / a.mass;
        b.ax -= fx / b.mass;
        b.ay -= fy / b.mass;
      }
    }
  }

  update(dt: number): void {
    // Run physics at 50× sim-time so orbits complete in ~5-10 seconds visually
    const simDt = dt * 50;
    this.time += simDt;

    // Velocity Verlet integration
    // Step 1: half-kick
    this.computeAccelerations();
    for (const b of this.bodies) {
      b.vx += 0.5 * b.ax * simDt;
      b.vy += 0.5 * b.ay * simDt;
      b.x += b.vx * simDt;
      b.y += b.vy * simDt;
    }

    // Step 2: recompute accelerations at new positions, then second half-kick
    this.computeAccelerations();
    for (const b of this.bodies) {
      b.vx += 0.5 * b.ax * simDt;
      b.vy += 0.5 * b.ay * simDt;
    }

    // Record trails
    for (const b of this.bodies) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > MAX_TRAIL) b.trail.shift();
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 60, 'rgba(255,255,255,0.03)');

    // Trails
    if (this.showTrails) {
      for (const b of this.bodies) {
        if (b.trail.length < 2) continue;
        for (let i = 1; i < b.trail.length; i++) {
          const alpha = (i / b.trail.length) * 0.6;
          ctx.beginPath();
          ctx.strokeStyle = b.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = Math.max(1, b.radius * 0.4 * (i / b.trail.length));
          ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
          ctx.lineTo(b.trail[i].x, b.trail[i].y);
          ctx.stroke();
        }
      }
    }

    // Center of mass marker
    if (this.showCOM && this.bodies.length > 0) {
      let totalMass = 0, cmx = 0, cmy = 0;
      for (const b of this.bodies) {
        cmx += b.x * b.mass;
        cmy += b.y * b.mass;
        totalMass += b.mass;
      }
      cmx /= totalMass;
      cmy /= totalMass;

      ctx.save();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cmx - 10, cmy);
      ctx.lineTo(cmx + 10, cmy);
      ctx.moveTo(cmx, cmy - 10);
      ctx.lineTo(cmx, cmy + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cmx, cmy, 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      drawText(ctx, 'COM', cmx + 8, cmy - 8, '#64748b', '10px system-ui', 'left');
    }

    // Bodies
    for (const b of this.bodies) {
      // Glow
      const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 3);
      gradient.addColorStop(0, b.color + '60');
      gradient.addColorStop(1, b.color + '00');
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(b.x, b.y, b.radius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff30';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Drag velocity indicator
    if (this.dragging) {
      drawArrow(ctx, this.dragStartX, this.dragStartY, this.dragCurrentX, this.dragCurrentY, '#22c55e', 2, 10);
      ctx.beginPath();
      ctx.arc(this.dragStartX, this.dragStartY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e80';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Info
    drawText(ctx, `Bodies: ${this.bodies.length}`, 15, 20, '#94a3b8', '12px monospace', 'left');
    drawText(ctx, `Time: ${this.time.toFixed(1)}s`, 15, 38, '#94a3b8', '12px monospace', 'left');
    drawText(ctx, `G: ${this.G.toFixed(1)}`, 15, 56, '#94a3b8', '12px monospace', 'left');

    // Instructions
    drawText(ctx, 'Click to add body, drag for velocity', width / 2, height - 15, '#475569', '11px system-ui', 'center');
  }

  reset(): void {
    this.loadPreset(this.preset);
  }

  onPointerDown(x: number, y: number): void {
    this.dragging = true;
    this.dragStartX = x;
    this.dragStartY = y;
    this.dragCurrentX = x;
    this.dragCurrentY = y;
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging) {
      this.dragCurrentX = x;
      this.dragCurrentY = y;
    }
  }

  onPointerUp(x: number, y: number): void {
    if (this.dragging) {
      const vx = (x - this.dragStartX) * 0.02;
      const vy = (y - this.dragStartY) * 0.02;
      const mass = 5 + Math.random() * 20;
      this.bodies.push(this.makeBody(this.dragStartX, this.dragStartY, vx, vy, mass));
      this.dragging = false;
    }
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'G', label: 'G Scale', min: 0.1, max: 10, step: 0.1, defaultValue: 1.0 },
      { type: 'slider', key: 'softening', label: 'Softening', min: 1, max: 20, step: 0.5, defaultValue: 5 },
      { type: 'toggle', key: 'showTrails', label: 'Show Trails', defaultValue: true },
      { type: 'toggle', key: 'showCOM', label: 'Center of Mass', defaultValue: true },
      {
        type: 'dropdown', key: 'preset', label: 'Preset',
        options: [
          { value: 'binary-star', label: 'Binary Star' },
          { value: 'solar-system', label: 'Solar System' },
          { value: 'random-cluster', label: 'Random Cluster' },
          { value: 'figure-8', label: 'Figure-8' },
        ],
        defaultValue: 'binary-star',
      },
      { type: 'button', key: 'addBody', label: 'Add Random Body' },
      { type: 'button', key: 'clearAll', label: 'Clear All' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      G: this.G,
      softening: this.softening,
      showTrails: this.showTrails,
      showCOM: this.showCOM,
      preset: this.preset,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'G': this.G = value as number; break;
      case 'softening': this.softening = value as number; break;
      case 'showTrails':
        this.showTrails = value as boolean;
        if (!this.showTrails) for (const b of this.bodies) b.trail = [];
        break;
      case 'showCOM': this.showCOM = value as boolean; break;
      case 'preset':
        this.preset = value as string;
        this.loadPreset(this.preset);
        break;
      case 'addBody': {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const angle = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 120;
        this.bodies.push(this.makeBody(
          cx + r * Math.cos(angle), cy + r * Math.sin(angle),
          -Math.sin(angle) * 0.8, Math.cos(angle) * 0.8,
          5 + Math.random() * 15,
        ));
        break;
      }
      case 'clearAll':
        this.bodies = [];
        this.time = 0;
        break;
    }
  }
}

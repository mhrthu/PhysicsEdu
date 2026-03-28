import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { clearCanvas, drawGrid, drawArrow, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  color: string;
}

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#fbbf24', '#ec4899'];

export default class RigidBodyCollisionsSim extends SimulationEngine {
  private restitution = 1.0;
  private showMomentum = true;
  private showCOM = true;
  private balls: Ball[] = [];

  // Interaction
  private dragging = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragCurrent: { x: number; y: number } | null = null;
  private nextColor = 0;

  setup(): void {
    this.time = 0;
    this.balls = [];
    this.addDefaultBalls();
  }

  private addDefaultBalls(): void {
    this.balls.push(
      { x: this.width * 0.3, y: this.height * 0.5, vx: 120, vy: 0, radius: 25, mass: 1, color: COLORS[0] },
      { x: this.width * 0.7, y: this.height * 0.5, vx: -60, vy: 30, radius: 30, mass: 2, color: COLORS[1] },
    );
    this.nextColor = 2;
  }

  update(dt: number): void {
    const { balls, restitution } = this;

    // Move balls
    for (const b of balls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    // Wall collisions
    for (const b of balls) {
      if (b.x - b.radius < 0) { b.x = b.radius; b.vx = Math.abs(b.vx) * restitution; }
      if (b.x + b.radius > this.width) { b.x = this.width - b.radius; b.vx = -Math.abs(b.vx) * restitution; }
      if (b.y - b.radius < 0) { b.y = b.radius; b.vy = Math.abs(b.vy) * restitution; }
      if (b.y + b.radius > this.height) { b.y = this.height - b.radius; b.vy = -Math.abs(b.vy) * restitution; }
    }

    // Ball-ball collisions
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        if (dist < minDist && dist > 0.001) {
          // Normal direction
          const nx = dx / dist;
          const ny = dy / dist;

          // Relative velocity along normal
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dvn = dvx * nx + dvy * ny;

          if (dvn > 0) {
            // Impulse
            const imp = (1 + restitution) * dvn / (1 / a.mass + 1 / b.mass);

            a.vx -= imp * nx / a.mass;
            a.vy -= imp * ny / a.mass;
            b.vx += imp * nx / b.mass;
            b.vy += imp * ny / b.mass;

            // Separate
            const overlap = minDist - dist;
            const totalMass = a.mass + b.mass;
            a.x -= overlap * (b.mass / totalMass) * nx;
            a.y -= overlap * (b.mass / totalMass) * ny;
            b.x += overlap * (a.mass / totalMass) * nx;
            b.y += overlap * (a.mass / totalMass) * ny;
          }
        }
      }
    }

    this.time += dt;
  }

  render(): void {
    const { ctx, width, height, balls } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 40);

    // Draw drag velocity preview
    if (this.dragging && this.dragStart && this.dragCurrent) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251,191,36,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(this.dragStart.x, this.dragStart.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrow(ctx, this.dragStart.x, this.dragStart.y, this.dragCurrent.x, this.dragCurrent.y, '#fbbf24', 2, 8);
      ctx.restore();
    }

    // Draw balls
    for (const b of balls) {
      // Shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(b.x + 3, b.y + 3, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ball gradient
      const grad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, 0, b.x, b.y, b.radius);
      grad.addColorStop(0, this.lightenColor(b.color, 40));
      grad.addColorStop(1, b.color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Mass label
      drawText(ctx, `${b.mass.toFixed(1)}`, b.x, b.y, '#fff', '11px system-ui', 'center');

      // Momentum vectors
      if (this.showMomentum) {
        const scale = 0.5;
        const px = b.vx * b.mass * scale;
        const py = b.vy * b.mass * scale;
        if (Math.sqrt(px * px + py * py) > 2) {
          drawArrow(ctx, b.x, b.y, b.x + px, b.y + py, b.color, 2, 7);
        }
      }
    }

    // Center of mass
    if (this.showCOM && balls.length > 0) {
      let totalMass = 0;
      let comX = 0;
      let comY = 0;
      let totalPx = 0;
      let totalPy = 0;

      for (const b of balls) {
        totalMass += b.mass;
        comX += b.x * b.mass;
        comY += b.y * b.mass;
        totalPx += b.vx * b.mass;
        totalPy += b.vy * b.mass;
      }

      comX /= totalMass;
      comY /= totalMass;

      // Draw COM crosshair
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      const s = 10;
      ctx.beginPath();
      ctx.moveTo(comX - s, comY); ctx.lineTo(comX + s, comY);
      ctx.moveTo(comX, comY - s); ctx.lineTo(comX, comY + s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(comX, comY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.restore();

      drawText(ctx, 'COM', comX + 12, comY - 8, '#fbbf24', '11px system-ui');

      // Total momentum
      const totalP = Math.sqrt(totalPx * totalPx + totalPy * totalPy);
      drawText(ctx, `Total p = (${totalPx.toFixed(1)}, ${totalPy.toFixed(1)})  |p| = ${totalP.toFixed(1)}`, 16, height - 36, '#e2e8f0', '13px system-ui');
    }

    // Info
    let totalKE = 0;
    for (const b of balls) {
      totalKE += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy);
    }
    drawText(ctx, `Balls: ${balls.length}   KE = ${totalKE.toFixed(1)} J   e = ${this.restitution.toFixed(2)}`, 16, height - 14, '#94a3b8', '12px system-ui');
    drawText(ctx, 'Click + drag to add balls', width - 16, height - 14, '#64748b', '11px system-ui', 'right');
  }

  private lightenColor(hex: string, amount: number): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `rgb(${r},${g},${b})`;
  }

  reset(): void {
    this.balls = [];
    this.time = 0;
    this.dragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.nextColor = 0;
    this.addDefaultBalls();
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'restitution', label: 'Restitution (e)', min: 0, max: 1, step: 0.01, defaultValue: 1 },
      { type: 'toggle', key: 'showMomentum', label: 'Momentum Vectors', defaultValue: true },
      { type: 'toggle', key: 'showCOM', label: 'Center of Mass', defaultValue: true },
      { type: 'button', key: 'addBall', label: 'Add Random Ball' },
      { type: 'button', key: 'clear', label: 'Clear All' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      restitution: this.restitution,
      showMomentum: this.showMomentum,
      showCOM: this.showCOM,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'restitution': this.restitution = value as number; break;
      case 'showMomentum': this.showMomentum = value as boolean; break;
      case 'showCOM': this.showCOM = value as boolean; break;
      case 'addBall': this.addRandomBall(); break;
      case 'clear': this.balls = []; this.nextColor = 0; break;
    }
  }

  private addRandomBall(): void {
    const r = 15 + Math.random() * 20;
    this.balls.push({
      x: r + Math.random() * (this.width - 2 * r),
      y: r + Math.random() * (this.height - 2 * r),
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      radius: r,
      mass: Math.round((0.5 + Math.random() * 3) * 10) / 10,
      color: COLORS[this.nextColor % COLORS.length],
    });
    this.nextColor++;
  }

  onPointerDown(x: number, y: number): void {
    this.dragging = true;
    this.dragStart = { x, y };
    this.dragCurrent = { x, y };
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging) {
      this.dragCurrent = { x, y };
    }
  }

  onPointerUp(x: number, y: number): void {
    if (this.dragging && this.dragStart) {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      const r = 15 + Math.random() * 15;
      this.balls.push({
        x: this.dragStart.x,
        y: this.dragStart.y,
        vx: dx * 2,
        vy: dy * 2,
        radius: r,
        mass: Math.round((0.5 + Math.random() * 2.5) * 10) / 10,
        color: COLORS[this.nextColor % COLORS.length],
      });
      this.nextColor++;
    }
    this.dragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
  }
}

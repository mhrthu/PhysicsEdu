import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText } from '@/engine/render/drawUtils.ts';

interface LightClock {
  photonY: number;       // 0..1 normalized position between mirrors
  direction: number;     // 1 = up, -1 = down
  ticks: number;         // completed bounces
  photonX: number;       // horizontal offset for moving clock
  trail: { x: number; y: number }[];
}

export default class TimeDilationSim extends SimulationEngine {
  private velocity = 0.5;    // fraction of c
  private showPathTraces = true;

  private stationaryClock: LightClock = { photonY: 0, direction: 1, ticks: 0, photonX: 0, trail: [] };
  private movingClock: LightClock = { photonY: 0, direction: 1, ticks: 0, photonX: 0, trail: [] };

  private stationaryElapsed = 0;
  private movingElapsed = 0;

  // Layout constants (recalculated on setup/resize)
  private mirrorGap = 200;
  private mirrorWidth = 60;
  private clockBaseSpeed = 1.5; // bounces per second for stationary clock

  setup(): void {
    this.resetClocks();
  }

  private resetClocks(): void {
    this.stationaryClock = { photonY: 0, direction: 1, ticks: 0, photonX: 0, trail: [] };
    this.movingClock = { photonY: 0, direction: 1, ticks: 0, photonX: 0, trail: [] };
    this.stationaryElapsed = 0;
    this.movingElapsed = 0;
    this.time = 0;
  }

  private gamma(): number {
    return 1 / Math.sqrt(1 - this.velocity * this.velocity);
  }

  update(dt: number): void {
    this.time += dt;
    const speed = this.clockBaseSpeed;

    // Stationary clock: photon moves at full speed vertically
    this.advanceClock(this.stationaryClock, speed * dt, 0);
    this.stationaryElapsed += dt;

    // Moving clock: photon still travels at c, but part of its velocity is horizontal
    // Vertical component = c * sqrt(1 - v^2/c^2) = c / gamma
    const g = this.gamma();
    const verticalSpeed = speed / g;
    const horizontalDelta = this.velocity * speed * dt;
    this.advanceClock(this.movingClock, verticalSpeed * dt, horizontalDelta);
    this.movingElapsed += dt / g; // proper time ticks slower
  }

  private advanceClock(clock: LightClock, dyNorm: number, dxOffset: number): void {
    clock.photonY += clock.direction * dyNorm;
    clock.photonX += dxOffset;

    if (clock.photonY >= 1) {
      clock.photonY = 1 - (clock.photonY - 1);
      clock.direction = -1;
      clock.ticks++;
    } else if (clock.photonY <= 0) {
      clock.photonY = -(clock.photonY);
      clock.direction = 1;
      clock.ticks++;
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    this.mirrorGap = Math.min(height * 0.45, 220);
    this.mirrorWidth = Math.min(width * 0.08, 70);

    const leftCx = width * 0.28;
    const rightCx = width * 0.72;
    const centerY = height * 0.5;
    const topY = centerY - this.mirrorGap / 2;
    const botY = centerY + this.mirrorGap / 2;

    // Draw labels
    drawText(ctx, 'Stationary Clock', leftCx, topY - 35, '#e2e8f0', 'bold 14px system-ui', 'center');
    drawText(ctx, 'Moving Clock (v = ' + this.velocity.toFixed(2) + 'c)', rightCx, topY - 35, '#e2e8f0', 'bold 14px system-ui', 'center');

    // Draw stationary clock
    this.drawClock(leftCx, topY, botY, this.stationaryClock, false);

    // Draw moving clock
    this.drawClock(rightCx, topY, botY, this.movingClock, true);

    // Info overlay
    const g = this.gamma();
    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 230, infoY - 5, 235, 110);
    drawText(ctx, `v/c = ${this.velocity.toFixed(3)}`, infoX, infoY + 12, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `\u03B3 = ${g.toFixed(4)}`, infoX, infoY + 30, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Stationary time: ${this.stationaryElapsed.toFixed(2)} s`, infoX, infoY + 52, '#94a3b8', '12px monospace', 'right');
    drawText(ctx, `Moving time:     ${this.movingElapsed.toFixed(2)} s`, infoX, infoY + 70, '#94a3b8', '12px monospace', 'right');
    drawText(ctx, `Ticks: ${this.stationaryClock.ticks} vs ${this.movingClock.ticks}`, infoX, infoY + 92, '#94a3b8', '12px monospace', 'right');

    // Equation
    drawText(ctx, "t' = \u03B3 t = t / \u221A(1 - v\u00B2/c\u00B2)", width / 2, height - 25, '#64748b', '13px monospace', 'center');
  }

  private drawClock(cx: number, topY: number, botY: number, clock: LightClock, isMoving: boolean): void {
    const { ctx } = this;
    const hw = this.mirrorWidth / 2;

    // Mirrors
    ctx.save();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
    // Top mirror
    ctx.beginPath(); ctx.moveTo(cx - hw, topY); ctx.lineTo(cx + hw, topY); ctx.stroke();
    // Bottom mirror
    ctx.beginPath(); ctx.moveTo(cx - hw, botY); ctx.lineTo(cx + hw, botY); ctx.stroke();
    ctx.restore();

    // Photon position
    const photonScreenY = botY - clock.photonY * (botY - topY);

    // Path trace for moving clock
    if (isMoving && this.showPathTraces) {
      // Show diagonal path illustration
      const g = this.gamma();
      const diagHalf = this.velocity * (botY - topY) / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      // Draw a few zigzag segments to show the diagonal path
      const segments = 4;
      for (let i = 0; i < segments; i++) {
        const goingUp = i % 2 === 0;
        const startY = goingUp ? botY : topY;
        const endY = goingUp ? topY : botY;
        const startX = cx - diagHalf * (segments / 2 - i);
        const endX = startX + diagHalf;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Stationary clock path trace (straight vertical)
    if (!isMoving && this.showPathTraces) {
      ctx.save();
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx, botY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Photon
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, photonScreenY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();

    // Photon glow trail
    ctx.beginPath();
    ctx.arc(cx, photonScreenY, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
    ctx.fill();
  }

  reset(): void {
    this.resetClocks();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'velocity', label: 'Velocity', min: 0, max: 0.99, step: 0.01, defaultValue: 0.5, unit: 'c' },
      { type: 'toggle', key: 'showPathTraces', label: 'Show Path Traces', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      velocity: this.velocity,
      showPathTraces: this.showPathTraces,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'velocity':
        this.velocity = value as number;
        this.resetClocks();
        break;
      case 'showPathTraces':
        this.showPathTraces = value as boolean;
        break;
    }
  }
}

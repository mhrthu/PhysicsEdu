import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas } from '@/engine/render/drawUtils.ts';

interface Wavefront {
  x: number;          // emission x position (world)
  y: number;          // emission y position (world)
  radius: number;     // current radius in world units
  emitTime: number;   // time of emission
}

export default class DopplerEffectSim extends SimulationEngine {
  private sourceSpeed = 50;
  private frequency = 100;
  private soundSpeed = 343;

  private sourceX = 0;
  private sourceY = 0;
  private wavefronts: Wavefront[] = [];
  private lastEmitTime = 0;
  private scale = 1;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private worldOriginX = 0;
  private worldOriginY = 0;

  setup(): void {
    this.worldOriginX = this.width / 2;
    this.worldOriginY = this.height / 2;
    this.scale = Math.min(this.width, this.height) / 800;
    this.sourceX = -150;
    this.sourceY = 0;
    this.wavefronts = [];
    this.lastEmitTime = 0;
    this.time = 0;
  }

  private worldToCanvas(wx: number, wy: number): { x: number; y: number } {
    return {
      x: this.worldOriginX + wx * this.scale,
      y: this.worldOriginY + wy * this.scale,
    };
  }

  private canvasToWorld(cx: number, cy: number): { x: number; y: number } {
    return {
      x: (cx - this.worldOriginX) / this.scale,
      y: (cy - this.worldOriginY) / this.scale,
    };
  }

  update(dt: number): void {
    this.time += dt;

    // Move source horizontally
    this.sourceX += this.sourceSpeed * dt;

    // Wrap source around
    const halfW = (this.width / this.scale) / 2 + 50;
    if (this.sourceX > halfW) this.sourceX = -halfW;
    if (this.sourceX < -halfW) this.sourceX = halfW;

    // Emit wavefronts at source frequency
    const emitInterval = 1 / this.frequency * 20; // emit every ~20 wave periods for visual clarity
    if (this.time - this.lastEmitTime >= emitInterval) {
      this.wavefronts.push({
        x: this.sourceX,
        y: this.sourceY,
        radius: 0,
        emitTime: this.time,
      });
      this.lastEmitTime = this.time;
    }

    // Expand wavefronts
    for (const wf of this.wavefronts) {
      wf.radius = (this.time - wf.emitTime) * this.soundSpeed * 0.5;
    }

    // Remove wavefronts that are too large
    const maxRadius = Math.max(this.width, this.height) / this.scale;
    this.wavefronts = this.wavefronts.filter(wf => wf.radius < maxRadius);
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0f172a');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    const src = this.worldToCanvas(this.sourceX, this.sourceY);

    // Observer positions
    const obsAheadWorld = { x: this.sourceX + 200, y: this.sourceY };
    const obsBehindWorld = { x: this.sourceX - 200, y: this.sourceY };
    const obsAhead = this.worldToCanvas(obsAheadWorld.x, obsAheadWorld.y);
    const obsBehind = this.worldToCanvas(obsBehindWorld.x, obsBehindWorld.y);

    // Draw wavefronts
    for (const wf of this.wavefronts) {
      const center = this.worldToCanvas(wf.x, wf.y);
      const r = wf.radius * this.scale;
      if (r < 1) continue;

      // Determine color based on compression relative to source position
      const dx = wf.x - this.sourceX;
      const age = this.time - wf.emitTime;
      const alpha = Math.max(0.05, 0.5 - age * 0.15);

      // Wavefronts emitted from behind current source position appear stretched (red)
      // Wavefronts emitted from ahead appear compressed (blue)
      let color: string;
      if (this.sourceSpeed > 5) {
        if (dx < -10) {
          color = `rgba(96, 165, 250, ${alpha})`; // blue - compressed side
        } else if (dx > 10) {
          color = `rgba(248, 113, 113, ${alpha})`; // red - stretched side
        } else {
          color = `rgba(226, 232, 240, ${alpha})`;
        }
      } else {
        color = `rgba(226, 232, 240, ${alpha})`;
      }

      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw observers
    this.drawObserver(ctx, obsAhead.x, obsAhead.y, '#60a5fa', 'Ahead');
    this.drawObserver(ctx, obsBehind.x, obsBehind.y, '#f87171', 'Behind');

    // Draw source (speaker icon)
    this.drawSource(ctx, src.x, src.y);

    // Direction arrow for source motion
    if (this.sourceSpeed > 0) {
      const arrowLen = 30;
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.moveTo(src.x + 20, src.y);
      ctx.lineTo(src.x + 20 + arrowLen, src.y);
      ctx.lineTo(src.x + 20 + arrowLen - 8, src.y - 6);
      ctx.moveTo(src.x + 20 + arrowLen, src.y);
      ctx.lineTo(src.x + 20 + arrowLen - 8, src.y + 6);
      ctx.stroke();
      drawText(ctx, `v = ${this.sourceSpeed} m/s`, src.x + 20, src.y - 18, '#f59e0b', '11px system-ui', 'left');
    }

    // Compute observed frequencies
    // Observer ahead: source approaches -> v_source is negative (moving toward observer)
    const fAhead = this.frequency * (this.soundSpeed) / (this.soundSpeed - this.sourceSpeed);
    // Observer behind: source recedes -> v_source is positive (moving away from observer)
    const fBehind = this.frequency * (this.soundSpeed) / (this.soundSpeed + this.sourceSpeed);

    // Info overlay
    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 250, infoY - 5, 255, 120);

    drawText(ctx, 'Doppler Effect', infoX, infoY + 10, '#e2e8f0', 'bold 13px system-ui', 'right');
    drawText(ctx, `Source Freq: ${this.frequency} Hz`, infoX, infoY + 30, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Sound Speed: ${this.soundSpeed} m/s`, infoX, infoY + 48, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `f(ahead):  ${fAhead.toFixed(1)} Hz`, infoX, infoY + 70, '#60a5fa', '12px monospace', 'right');
    drawText(ctx, `f(behind): ${fBehind.toFixed(1)} Hz`, infoX, infoY + 88, '#f87171', '12px monospace', 'right');
    drawText(ctx, `Time: ${this.time.toFixed(2)} s`, infoX, infoY + 106, '#94a3b8', '11px monospace', 'right');

    // Formula at bottom
    drawText(ctx, 'f_obs = f_src \u00D7 v_sound / (v_sound \u00B1 v_source)', width / 2, height - 20, '#64748b', '12px monospace', 'center');
  }

  private drawSource(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Speaker body
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x - 10, y - 8, 10, 16);
    // Speaker cone
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 12, y - 16);
    ctx.lineTo(x + 12, y + 16);
    ctx.lineTo(x, y + 8);
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sound waves from speaker
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 14, y, 5 + i * 5, -Math.PI / 4, Math.PI / 4);
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 - i * 0.12})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private drawObserver(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string): void {
    // Ear/person icon
    ctx.beginPath();
    ctx.arc(x, y - 12, 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 12);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    drawText(ctx, label, x, y + 28, color, '11px system-ui', 'center');
  }

  reset(): void {
    this.setup();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.worldOriginX = this.width / 2;
    this.worldOriginY = this.height / 2;
    this.scale = Math.min(this.width, this.height) / 800;
  }

  onPointerDown(x: number, y: number): void {
    const src = this.worldToCanvas(this.sourceX, this.sourceY);
    const dx = x - src.x;
    const dy = y - src.y;
    if (dx * dx + dy * dy < 900) {
      this.dragging = true;
      this.dragOffsetX = dx;
      this.dragOffsetY = dy;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    const world = this.canvasToWorld(x - this.dragOffsetX, y - this.dragOffsetY);
    this.sourceX = world.x;
    this.sourceY = world.y;
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'sourceSpeed', label: 'Source Speed', min: 0, max: 300, step: 5, defaultValue: 50, unit: 'm/s' },
      { type: 'slider', key: 'frequency', label: 'Frequency', min: 10, max: 1000, step: 10, defaultValue: 100, unit: 'Hz' },
      { type: 'slider', key: 'soundSpeed', label: 'Sound Speed', min: 300, max: 400, step: 1, defaultValue: 343, unit: 'm/s' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      sourceSpeed: this.sourceSpeed,
      frequency: this.frequency,
      soundSpeed: this.soundSpeed,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'sourceSpeed': this.sourceSpeed = value as number; break;
      case 'frequency': this.frequency = value as number; break;
      case 'soundSpeed': this.soundSpeed = value as number; break;
    }
  }
}

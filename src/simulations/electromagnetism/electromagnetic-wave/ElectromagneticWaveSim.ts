import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { clearCanvas, drawText, drawArrow } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

type Polarization = 'linear' | 'circular';

// Pseudo-3D projection helpers
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const COS_ISO = Math.cos(ISO_ANGLE);
const SIN_ISO = Math.sin(ISO_ANGLE);

export default class ElectromagneticWaveSim extends SimulationEngine {
  private frequency: number = 3;
  private amplitude: number = 1.0;
  private polarization: Polarization = 'linear';
  private showE: boolean = true;
  private showB: boolean = true;

  setup(): void {}

  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);

    // Draw subtle background grid along z-axis
    this.renderBackgroundGrid();

    // Origin in screen space
    const originX = width * 0.12;
    const originY = height * 0.5;
    const zLen = width * 0.78; // length along propagation axis

    // Draw propagation axis (z)
    this.drawAxis(originX, originY, zLen);

    // Draw wave — c = λf, so higher frequency = shorter wavelength
    // k scales with frequency so more cycles appear at higher f
    // Wave speed (ω/k) stays constant: ω = k * waveSpeed
    const numPoints = 300;
    // k ∝ frequency → shorter wavelength at higher f (c = λf = const)
    const k = (this.frequency * 2 * Math.PI) / zLen;
    const ampScale = this.amplitude * height * 0.22;
    // phase = ω·t where ω = k·c, and c is fixed → wave speed is constant
    const phase = this.time * this.frequency * 3.0;

    // Collect points for E and B waves
    const ePoints: { sx: number; sy: number; ex: number; ey: number }[] = [];
    const bPoints: { sx: number; sy: number; ex: number; ey: number }[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const z = t * zLen;
      const waveArg = k * z - phase;

      // Position on the z-axis in screen space
      const screenZ_x = originX + z;
      const screenZ_y = originY;

      if (this.polarization === 'linear') {
        // E field oscillates in y direction (screen up/down)
        const eVal = Math.sin(waveArg) * ampScale;
        // B field oscillates in x direction (projected into screen as depth)
        const bVal = Math.sin(waveArg) * ampScale;

        if (this.showE) {
          ePoints.push({
            sx: screenZ_x,
            sy: screenZ_y,
            ex: screenZ_x,
            ey: screenZ_y - eVal, // up is negative y
          });
        }

        if (this.showB) {
          // Project B into the "depth" direction using isometric
          bPoints.push({
            sx: screenZ_x,
            sy: screenZ_y,
            ex: screenZ_x + bVal * COS_ISO * 0.5,
            ey: screenZ_y + bVal * SIN_ISO * 0.5,
          });
        }
      } else {
        // Circular polarization
        const eVal = Math.sin(waveArg) * ampScale;
        const ePerpVal = Math.cos(waveArg) * ampScale;

        if (this.showE) {
          // E rotates in the y-perpendicular plane
          ePoints.push({
            sx: screenZ_x,
            sy: screenZ_y,
            ex: screenZ_x + ePerpVal * COS_ISO * 0.3,
            ey: screenZ_y - eVal + ePerpVal * SIN_ISO * 0.3,
          });
        }

        if (this.showB) {
          // B is always perpendicular to E, 90 degrees behind
          const bVal2 = Math.cos(waveArg) * ampScale;
          const bPerpVal = -Math.sin(waveArg) * ampScale;
          bPoints.push({
            sx: screenZ_x,
            sy: screenZ_y,
            ex: screenZ_x + bPerpVal * COS_ISO * 0.3,
            ey: screenZ_y - bVal2 * 0.5 + bPerpVal * SIN_ISO * 0.3,
          });
        }
      }
    }

    // Render field lines as filled curves for visual richness
    if (this.showB && bPoints.length > 1) {
      this.renderWaveCurve(bPoints, 'rgba(59,130,246,0.6)', 'rgba(59,130,246,0.08)');
    }
    if (this.showE && ePoints.length > 1) {
      this.renderWaveCurve(ePoints, 'rgba(239,68,68,0.7)', 'rgba(239,68,68,0.08)');
    }

    // Draw field arrows at intervals
    const arrowInterval = Math.floor(numPoints / 20);
    if (this.showE) {
      for (let i = 0; i < ePoints.length; i += arrowInterval) {
        const p = ePoints[i];
        const dy = p.ey - p.sy;
        const dx = p.ex - p.sx;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 8) {
          drawArrow(ctx, p.sx, p.sy, p.ex, p.ey, 'rgba(248,113,113,0.7)', 1.5, 6);
        }
      }
    }
    if (this.showB) {
      for (let i = 0; i < bPoints.length; i += arrowInterval) {
        const p = bPoints[i];
        const dy = p.ey - p.sy;
        const dx = p.ex - p.sx;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 8) {
          drawArrow(ctx, p.sx, p.sy, p.ex, p.ey, 'rgba(96,165,250,0.7)', 1.5, 6);
        }
      }
    }

    // Labels
    this.renderLabels();
  }

  private renderBackgroundGrid(): void {
    const { ctx, width, height } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(148,163,184,0.04)';
    ctx.lineWidth = 1;
    const spacing = 30;
    for (let x = 0; x < width; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();
  }

  private drawAxis(ox: number, oy: number, zLen: number): void {
    const { ctx, height } = this;
    ctx.save();

    // Z axis (propagation direction)
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + zLen, oy);
    ctx.stroke();
    drawText(ctx, 'z (propagation)', ox + zLen + 8, oy, '#64748b', '12px system-ui', 'left');

    // Y axis (E field direction for linear)
    const yAxisLen = height * 0.3;
    ctx.strokeStyle = 'rgba(239,68,68,0.25)';
    ctx.beginPath();
    ctx.moveTo(ox, oy - yAxisLen);
    ctx.lineTo(ox, oy + yAxisLen);
    ctx.stroke();
    drawText(ctx, 'E', ox - 4, oy - yAxisLen - 10, '#f87171', 'bold 13px system-ui', 'center');

    // X axis (B field direction, projected)
    const bAxisLen = height * 0.2;
    ctx.strokeStyle = 'rgba(59,130,246,0.25)';
    ctx.beginPath();
    ctx.moveTo(ox - bAxisLen * COS_ISO, oy - bAxisLen * SIN_ISO);
    ctx.lineTo(ox + bAxisLen * COS_ISO, oy + bAxisLen * SIN_ISO);
    ctx.stroke();
    drawText(ctx, 'B', ox + bAxisLen * COS_ISO + 10, oy + bAxisLen * SIN_ISO,
      '#60a5fa', 'bold 13px system-ui', 'center');

    ctx.restore();
  }

  private renderWaveCurve(
    points: { sx: number; sy: number; ex: number; ey: number }[],
    strokeColor: string,
    fillColor: string
  ): void {
    const { ctx } = this;
    if (points.length < 2) return;

    ctx.save();

    // Filled area
    ctx.beginPath();
    ctx.moveTo(points[0].sx, points[0].sy);
    for (const p of points) {
      ctx.lineTo(p.ex, p.ey);
    }
    // Close back along the axis
    for (let i = points.length - 1; i >= 0; i--) {
      ctx.lineTo(points[i].sx, points[i].sy);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Wave line
    ctx.beginPath();
    ctx.moveTo(points[0].ex, points[0].ey);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].ex, points[i].ey);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private renderLabels(): void {
    const { ctx, width, height } = this;

    // Title info
    drawText(ctx, 'Electromagnetic Wave Propagation', width / 2, 26,
      '#e2e8f0', 'bold 16px system-ui', 'center');

    const polLabel = this.polarization === 'linear' ? 'Linear' : 'Circular';
    drawText(ctx, `Polarization: ${polLabel}  |  f = ${this.frequency} Hz  |  A = ${this.amplitude.toFixed(1)}`,
      width / 2, 48, '#94a3b8', '13px system-ui', 'center');

    // Legend
    if (this.showE) {
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(width - 130, height - 52, 14, 3);
      ctx.restore();
      drawText(ctx, 'E field', width - 110, height - 50, '#f87171', '12px system-ui', 'left');
    }
    if (this.showB) {
      ctx.save();
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(width - 130, height - 34, 14, 3);
      ctx.restore();
      drawText(ctx, 'B field', width - 110, height - 32, '#60a5fa', '12px system-ui', 'left');
    }

    // Equation
    drawText(ctx, 'c = \u03BBf = 1/\u221A(\u03BC\u2080\u03B5\u2080)', width / 2, height - 16,
      'rgba(148,163,184,0.5)', '12px system-ui', 'center');
  }

  reset(): void {
    this.frequency = 3;
    this.amplitude = 1.0;
    this.polarization = 'linear';
    this.showE = true;
    this.showB = true;
    this.time = 0;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'frequency', label: 'Frequency', min: 1, max: 10, step: 0.5, defaultValue: 3, unit: 'Hz' },
      { type: 'slider', key: 'amplitude', label: 'Amplitude', min: 0.5, max: 2, step: 0.1, defaultValue: 1.0 },
      {
        type: 'dropdown', key: 'polarization', label: 'Polarization',
        options: [
          { value: 'linear', label: 'Linear' },
          { value: 'circular', label: 'Circular' },
        ],
        defaultValue: 'linear',
      },
      { type: 'toggle', key: 'showE', label: 'E Field', defaultValue: true },
      { type: 'toggle', key: 'showB', label: 'B Field', defaultValue: true },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      frequency: this.frequency,
      amplitude: this.amplitude,
      polarization: this.polarization,
      showE: this.showE,
      showB: this.showB,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'frequency': this.frequency = value as number; break;
      case 'amplitude': this.amplitude = value as number; break;
      case 'polarization': this.polarization = value as Polarization; break;
      case 'showE': this.showE = value as boolean; break;
      case 'showB': this.showB = value as boolean; break;
    }
  }
}

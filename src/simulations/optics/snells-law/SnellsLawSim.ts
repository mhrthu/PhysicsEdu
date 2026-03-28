import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText, drawDashedLine } from '@/engine/render/drawUtils.ts';

interface Medium {
  name: string;
  n: number;
  color: string;
}

const MEDIA: Record<string, Medium> = {
  air:     { name: 'Air',     n: 1.00, color: '#0f172a' },
  water:   { name: 'Water',   n: 1.33, color: '#0c1a3d' },
  glass:   { name: 'Glass',   n: 1.52, color: '#111638' },
  diamond: { name: 'Diamond', n: 2.42, color: '#160f2e' },
};

export default class SnellsLawSim extends SimulationEngine {
  private medium1 = 'air';
  private medium2 = 'glass';
  private incidentAngle = 30;

  private interfaceY = 0;
  private hitX = 0;

  setup(): void {
    this.interfaceY = this.height / 2;
    this.hitX = this.width / 2;
  }

  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    const m1 = MEDIA[this.medium1];
    const m2 = MEDIA[this.medium2];
    const iy = this.interfaceY;
    const hx = this.hitX;

    // Background - two media
    clearCanvas(ctx, width, height, '#0f172a');
    ctx.fillStyle = m1.color;
    ctx.fillRect(0, 0, width, iy);
    ctx.fillStyle = m2.color;
    ctx.fillRect(0, iy, width, height - iy);

    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    // Interface line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, iy);
    ctx.lineTo(width, iy);
    ctx.stroke();

    // Normal line (dashed vertical)
    drawDashedLine(ctx, hx, iy - 180, hx, iy + 180, '#64748b', 1.5, [6, 6]);
    drawText(ctx, 'Normal', hx + 8, iy - 170, '#64748b', '10px system-ui', 'left');

    // Compute angles
    const theta1Rad = (this.incidentAngle * Math.PI) / 180;
    const n1 = m1.n;
    const n2 = m2.n;
    const sinTheta2 = (n1 * Math.sin(theta1Rad)) / n2;
    const totalInternalReflection = sinTheta2 > 1;
    const theta2Rad = totalInternalReflection ? 0 : Math.asin(sinTheta2);
    const criticalAngle = n1 > n2 ? Math.asin(n2 / n1) * 180 / Math.PI : NaN;

    // Ray length
    const rayLen = 160;
    const rayColor = '#dc2626';
    const reflectColor = '#f97316';
    const refractColor = '#3b82f6';

    // Incident ray (coming from upper-left toward hit point)
    const incX = hx - rayLen * Math.sin(theta1Rad);
    const incY = iy - rayLen * Math.cos(theta1Rad);
    ctx.strokeStyle = rayColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(incX, incY);
    ctx.lineTo(hx, iy);
    ctx.stroke();
    // Arrowhead on incident ray
    this.drawRayArrow(ctx, incX, incY, hx, iy, rayColor);

    // Reflected ray (always shown)
    const refX = hx + rayLen * Math.sin(theta1Rad);
    const refY = iy - rayLen * Math.cos(theta1Rad);
    ctx.strokeStyle = reflectColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, iy);
    ctx.lineTo(refX, refY);
    ctx.stroke();
    this.drawRayArrow(ctx, hx, iy, refX, refY, reflectColor);

    // Refracted ray or total internal reflection
    if (totalInternalReflection) {
      drawText(ctx, 'Total Internal Reflection!', hx, iy + 30, '#dc2626', 'bold 13px system-ui', 'center');
    } else {
      const transX = hx + rayLen * Math.sin(theta2Rad);
      const transY = iy + rayLen * Math.cos(theta2Rad);
      ctx.strokeStyle = refractColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx, iy);
      ctx.lineTo(transX, transY);
      ctx.stroke();
      this.drawRayArrow(ctx, hx, iy, transX, transY, refractColor);
    }

    // Angle arcs
    this.drawAngleArc(ctx, hx, iy, -Math.PI / 2, -Math.PI / 2 + theta1Rad, 50, rayColor, '\u03B8\u2081');
    this.drawAngleArc(ctx, hx, iy, -Math.PI / 2, -Math.PI / 2 - theta1Rad, 40, reflectColor, '\u03B8r');
    if (!totalInternalReflection) {
      this.drawAngleArc(ctx, hx, iy, Math.PI / 2, Math.PI / 2 - theta2Rad, 50, refractColor, '\u03B8\u2082');
    }

    // Medium labels
    drawText(ctx, `${m1.name} (n\u2081 = ${n1.toFixed(2)})`, 20, 30, '#e2e8f0', 'bold 13px system-ui', 'left');
    drawText(ctx, `${m2.name} (n\u2082 = ${n2.toFixed(2)})`, 20, iy + 30, '#e2e8f0', 'bold 13px system-ui', 'left');

    // Title
    drawText(ctx, 'Snell\'s Law: n\u2081 sin\u03B8\u2081 = n\u2082 sin\u03B8\u2082', width / 2, 24, '#e2e8f0', 'bold 15px system-ui', 'center');

    // Info overlay
    const infoX = width - 15;
    const infoY = 50;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const boxW = 220;
    const boxH = totalInternalReflection ? 100 : 82;
    ctx.fillRect(infoX - boxW, infoY - 5, boxW + 5, boxH);
    ctx.strokeRect(infoX - boxW, infoY - 5, boxW + 5, boxH);

    drawText(ctx, `\u03B8\u2081 (incident) = ${this.incidentAngle.toFixed(1)}\u00B0`, infoX, infoY + 12, '#e2e8f0', '12px monospace', 'right');
    if (totalInternalReflection) {
      drawText(ctx, '\u03B8\u2082 = N/A (TIR)', infoX, infoY + 30, '#dc2626', '12px monospace', 'right');
    } else {
      const theta2Deg = (theta2Rad * 180) / Math.PI;
      drawText(ctx, `\u03B8\u2082 (refracted) = ${theta2Deg.toFixed(1)}\u00B0`, infoX, infoY + 30, '#e2e8f0', '12px monospace', 'right');
    }
    drawText(ctx, `n\u2081 = ${n1.toFixed(2)}, n\u2082 = ${n2.toFixed(2)}`, infoX, infoY + 48, '#94a3b8', '11px monospace', 'right');
    if (!isNaN(criticalAngle)) {
      drawText(ctx, `Critical angle = ${criticalAngle.toFixed(1)}\u00B0`, infoX, infoY + 66, '#94a3b8', '11px monospace', 'right');
    } else {
      drawText(ctx, 'No critical angle (n\u2081 \u2264 n\u2082)', infoX, infoY + 66, '#64748b', '11px monospace', 'right');
    }
    if (totalInternalReflection) {
      drawText(ctx, 'sin\u03B8\u2082 > 1 \u2192 Total Internal Reflection', infoX, infoY + 84, '#dc2626', '11px monospace', 'right');
    }

    // Legend
    const ly = height - 40;
    ctx.fillStyle = rayColor;
    ctx.fillRect(20, ly - 5, 14, 3);
    drawText(ctx, 'Incident', 40, ly - 3, '#94a3b8', '10px system-ui', 'left');
    ctx.fillStyle = reflectColor;
    ctx.fillRect(100, ly - 5, 14, 3);
    drawText(ctx, 'Reflected', 120, ly - 3, '#94a3b8', '10px system-ui', 'left');
    ctx.fillStyle = refractColor;
    ctx.fillRect(195, ly - 5, 14, 3);
    drawText(ctx, 'Refracted', 215, ly - 3, '#94a3b8', '10px system-ui', 'left');
  }

  private drawRayArrow(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number, color: string
  ): void {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(mx + size * Math.cos(angle), my + size * Math.sin(angle));
    ctx.lineTo(mx - size * Math.cos(angle - Math.PI / 5), my - size * Math.sin(angle - Math.PI / 5));
    ctx.lineTo(mx - size * Math.cos(angle + Math.PI / 5), my - size * Math.sin(angle + Math.PI / 5));
    ctx.closePath();
    ctx.fill();
  }

  private drawAngleArc(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    startAngle: number, endAngle: number,
    radius: number, color: string, label: string
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (startAngle < endAngle) {
      ctx.arc(cx, cy, radius, startAngle, endAngle);
    } else {
      ctx.arc(cx, cy, radius, endAngle, startAngle);
    }
    ctx.stroke();

    const midAngle = (startAngle + endAngle) / 2;
    const lx = cx + (radius + 14) * Math.cos(midAngle);
    const ly = cy + (radius + 14) * Math.sin(midAngle);
    drawText(ctx, label, lx, ly, color, 'bold 12px system-ui', 'center');
    ctx.restore();
  }

  reset(): void {
    this.setup();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.interfaceY = this.height / 2;
    this.hitX = this.width / 2;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown', key: 'medium1', label: 'Medium 1 (top)',
        options: [
          { value: 'air', label: 'Air (n=1.00)' },
          { value: 'water', label: 'Water (n=1.33)' },
          { value: 'glass', label: 'Glass (n=1.52)' },
          { value: 'diamond', label: 'Diamond (n=2.42)' },
        ],
        defaultValue: 'air',
      },
      {
        type: 'dropdown', key: 'medium2', label: 'Medium 2 (bottom)',
        options: [
          { value: 'air', label: 'Air (n=1.00)' },
          { value: 'water', label: 'Water (n=1.33)' },
          { value: 'glass', label: 'Glass (n=1.52)' },
          { value: 'diamond', label: 'Diamond (n=2.42)' },
        ],
        defaultValue: 'glass',
      },
      { type: 'slider', key: 'incidentAngle', label: 'Angle of Incidence', min: 0, max: 89, step: 1, defaultValue: 30, unit: '\u00B0' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      medium1: this.medium1,
      medium2: this.medium2,
      incidentAngle: this.incidentAngle,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'medium1': this.medium1 = value as string; break;
      case 'medium2': this.medium2 = value as string; break;
      case 'incidentAngle': this.incidentAngle = value as number; break;
    }
  }
}

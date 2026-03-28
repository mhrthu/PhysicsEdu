import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { drawGrid, drawText, clearCanvas, drawDashedLine } from '@/engine/render/drawUtils.ts';

interface Star {
  /** Angular position x relative to canvas center (pixels) */
  x: number;
  /** Angular position y relative to canvas center (pixels) */
  y: number;
  brightness: number;
  size: number;
}

interface RayPath {
  points: { x: number; y: number }[];
  color: string;
}

export default class GravitationalLensingSim extends SimulationEngine {
  private lensMass = 20; // solar masses (display scaling)
  private sourceDist = 1.5; // relative distance factor
  private showRayTraces = true;
  private showMagnification = false;

  private lensX = 0;
  private lensY = 0;
  private draggingLens = false;

  private backgroundStars: Star[] = [];
  private seed = 42;

  setup(): void {
    this.lensX = this.width / 2;
    this.lensY = this.height / 2;
    this.generateStarField();
  }

  private seededRandom(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return this.seed / 2147483647;
  }

  private generateStarField(): void {
    this.seed = 42;
    this.backgroundStars = [];
    for (let i = 0; i < 300; i++) {
      this.backgroundStars.push({
        x: this.seededRandom() * this.width,
        y: this.seededRandom() * this.height,
        brightness: 0.3 + this.seededRandom() * 0.7,
        size: 0.5 + this.seededRandom() * 2.0,
      });
    }
  }

  /** Einstein radius in pixels for display purposes */
  private getEinsteinRadius(): number {
    return Math.sqrt(this.lensMass * this.sourceDist) * 8;
  }

  /**
   * Compute lensed position of a background star.
   * Uses thin-lens approximation: theta_image = theta_source + alpha
   * where alpha = theta_E^2 / theta for the point mass lens.
   * Returns two images (+ and - parity).
   */
  private lensPosition(sx: number, sy: number): { x: number; y: number; mag: number }[] {
    const dx = sx - this.lensX;
    const dy = sy - this.lensY;
    const beta = Math.sqrt(dx * dx + dy * dy); // angular separation from lens
    const thetaE = this.getEinsteinRadius();

    if (beta < 0.5) {
      // Source nearly behind lens -> Einstein ring (approximate as ring of points)
      return [{ x: this.lensX + thetaE, y: this.lensY, mag: 5 }];
    }

    const angle = Math.atan2(dy, dx);

    // Two image positions from lens equation: theta = (beta +/- sqrt(beta^2 + 4 thetaE^2)) / 2
    const disc = Math.sqrt(beta * beta + 4 * thetaE * thetaE);
    const thetaPlus = (beta + disc) / 2;
    const thetaMinus = (beta - disc) / 2;

    const magPlus = Math.abs((thetaPlus / beta) * (thetaPlus / (thetaPlus - thetaE * thetaE / thetaPlus)));
    const magMinus = Math.abs((thetaMinus / beta) * (thetaMinus / (thetaMinus - thetaE * thetaE / thetaMinus)));

    return [
      {
        x: this.lensX + thetaPlus * Math.cos(angle),
        y: this.lensY + thetaPlus * Math.sin(angle),
        mag: Math.min(magPlus, 8),
      },
      {
        x: this.lensX + Math.abs(thetaMinus) * Math.cos(angle + Math.PI),
        y: this.lensY + Math.abs(thetaMinus) * Math.sin(angle + Math.PI),
        mag: Math.min(magMinus, 5),
      },
    ];
  }

  /** Generate ray trace paths showing how light bends around the lens */
  private computeRayPaths(): RayPath[] {
    const paths: RayPath[] = [];
    const thetaE = this.getEinsteinRadius();
    const numRays = 16;
    const colors = ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc'];

    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      // Ray comes from far away, passes near lens, bends
      const impactParam = thetaE * (0.3 + (i % 4) * 0.5);
      const points: { x: number; y: number }[] = [];

      // Incoming ray from edge
      const farDist = Math.max(this.width, this.height);
      const startX = this.lensX + farDist * Math.cos(angle);
      const startY = this.lensY + farDist * Math.sin(angle);

      // Closest approach point
      const perpAngle = angle + Math.PI / 2;
      const closestX = this.lensX + impactParam * Math.cos(perpAngle);
      const closestY = this.lensY + impactParam * Math.sin(perpAngle);

      // Deflection angle: alpha = thetaE^2 / impactParam
      const deflection = (thetaE * thetaE) / Math.max(impactParam, 1);
      const exitAngle = angle + Math.PI + deflection * 0.05;

      const endX = closestX + farDist * Math.cos(exitAngle);
      const endY = closestY + farDist * Math.sin(exitAngle);

      points.push({ x: startX, y: startY });
      points.push({ x: closestX, y: closestY });
      points.push({ x: endX, y: endY });

      paths.push({ points, color: colors[i % colors.length] });
    }

    return paths;
  }

  update(dt: number): void {
    this.time += dt;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#0a0e1a');

    // Very subtle grid
    drawGrid(ctx, width, height, 80, 'rgba(255,255,255,0.015)');

    const thetaE = this.getEinsteinRadius();

    // Magnification map
    if (this.showMagnification) {
      const step = 8;
      for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
          const dx = x - this.lensX;
          const dy = y - this.lensY;
          const beta = Math.sqrt(dx * dx + dy * dy);
          if (beta < 1) continue;
          const u = beta / thetaE;
          const mu = (u * u + 2) / (u * Math.sqrt(u * u + 4));
          const intensity = Math.min(1, (mu - 1) * 0.3);
          if (intensity > 0.01) {
            ctx.fillStyle = `rgba(147, 51, 234, ${intensity * 0.4})`;
            ctx.fillRect(x - step / 2, y - step / 2, step, step);
          }
        }
      }
    }

    // Ray traces
    if (this.showRayTraces) {
      const paths = this.computeRayPaths();
      for (const path of paths) {
        ctx.beginPath();
        ctx.strokeStyle = path.color + '40';
        ctx.lineWidth = 1;
        for (let i = 0; i < path.points.length; i++) {
          if (i === 0) ctx.moveTo(path.points[i].x, path.points[i].y);
          else ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
    }

    // Background stars (unlensed, very faint)
    for (const star of this.backgroundStars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 210, 230, ${star.brightness * 0.15})`;
      ctx.fill();
    }

    // Lensed star images
    for (const star of this.backgroundStars) {
      const images = this.lensPosition(star.x, star.y);
      for (const img of images) {
        if (img.x < -20 || img.x > width + 20 || img.y < -20 || img.y > height + 20) continue;
        const sz = star.size * Math.min(img.mag, 4) * 0.8;
        const alpha = Math.min(1, star.brightness * Math.sqrt(img.mag) * 0.8);

        // Glow
        if (sz > 1.5) {
          const glow = ctx.createRadialGradient(img.x, img.y, 0, img.x, img.y, sz * 3);
          glow.addColorStop(0, `rgba(180, 200, 255, ${alpha * 0.3})`);
          glow.addColorStop(1, 'rgba(180, 200, 255, 0)');
          ctx.beginPath();
          ctx.fillStyle = glow;
          ctx.arc(img.x, img.y, sz * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(img.x, img.y, Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx.fill();
      }
    }

    // Einstein ring
    ctx.beginPath();
    ctx.arc(this.lensX, this.lensY, thetaE, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    drawText(ctx, `theta_E`, this.lensX + thetaE + 8, this.lensY - 8, '#6366f1', '11px monospace', 'left');

    // Einstein ring highlight (bright ring when source is near the optical axis)
    // Find how close any bright star cluster is to the lens axis
    const ringBrightness = Math.max(0, 1 - Math.sqrt(
      Math.pow(width / 2 - this.lensX, 2) + Math.pow(height / 2 - this.lensY, 2)
    ) / 200);
    if (ringBrightness > 0.05) {
      ctx.beginPath();
      ctx.arc(this.lensX, this.lensY, thetaE, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(167, 139, 250, ${ringBrightness * 0.6})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Lens body (massive object)
    const lensGlow = ctx.createRadialGradient(this.lensX, this.lensY, 0, this.lensX, this.lensY, 30);
    lensGlow.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    lensGlow.addColorStop(0.5, 'rgba(99, 102, 241, 0.1)');
    lensGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.beginPath();
    ctx.fillStyle = lensGlow;
    ctx.arc(this.lensX, this.lensY, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.lensX, this.lensY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#312e81';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crosshair on lens
    drawDashedLine(ctx, this.lensX - 15, this.lensY, this.lensX + 15, this.lensY, '#6366f180', 1, [3, 3]);
    drawDashedLine(ctx, this.lensX, this.lensY - 15, this.lensX, this.lensY + 15, '#6366f180', 1, [3, 3]);

    // Info panel
    ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
    ctx.fillRect(10, 10, 220, 100);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 220, 100);

    drawText(ctx, 'Gravitational Lensing', 20, 28, '#e2e8f0', 'bold 13px system-ui', 'left');
    drawText(ctx, `Lens Mass: ${this.lensMass.toFixed(0)} M_sun`, 20, 48, '#94a3b8', '11px monospace', 'left');
    drawText(ctx, `Einstein Radius: ${thetaE.toFixed(1)} px`, 20, 64, '#94a3b8', '11px monospace', 'left');
    drawText(ctx, `Source Distance: ${this.sourceDist.toFixed(1)}x`, 20, 80, '#94a3b8', '11px monospace', 'left');
    drawText(ctx, `alpha = 4GM/(rc^2)`, 20, 100, '#6366f1', '10px monospace', 'left');

    // Instructions
    drawText(ctx, 'Drag to move lens', width / 2, height - 15, '#475569', '11px system-ui', 'center');
  }

  reset(): void {
    this.lensX = this.width / 2;
    this.lensY = this.height / 2;
    this.time = 0;
    this.generateStarField();
  }

  onPointerDown(x: number, y: number): void {
    const dx = x - this.lensX;
    const dy = y - this.lensY;
    if (dx * dx + dy * dy < 900) {
      this.draggingLens = true;
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.draggingLens) {
      this.lensX = x;
      this.lensY = y;
    }
  }

  onPointerUp(_x: number, _y: number): void {
    this.draggingLens = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      { type: 'slider', key: 'lensMass', label: 'Lens Mass', min: 1, max: 100, step: 1, defaultValue: 20, unit: 'M_sun' },
      { type: 'slider', key: 'sourceDist', label: 'Source Distance', min: 0.5, max: 5, step: 0.1, defaultValue: 1.5 },
      { type: 'toggle', key: 'showRayTraces', label: 'Ray Traces', defaultValue: true },
      { type: 'toggle', key: 'showMagnification', label: 'Magnification Map', defaultValue: false },
      { type: 'button', key: 'reset', label: 'Reset' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      lensMass: this.lensMass,
      sourceDist: this.sourceDist,
      showRayTraces: this.showRayTraces,
      showMagnification: this.showMagnification,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'lensMass': this.lensMass = value as number; break;
      case 'sourceDist': this.sourceDist = value as number; break;
      case 'showRayTraces': this.showRayTraces = value as boolean; break;
      case 'showMagnification': this.showMagnification = value as boolean; break;
      case 'reset': this.reset(); break;
    }
  }
}

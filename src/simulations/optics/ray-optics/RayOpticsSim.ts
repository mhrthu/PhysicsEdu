import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText, drawDashedLine } from '@/engine/render/drawUtils.ts';

// ── Types ────────────────────────────────────────────────────────────────────

interface Vec2 { x: number; y: number }

interface Ray {
  origin: Vec2;
  dir: Vec2; // unit vector
  color: string;
  wavelength: number; // 380-700 nm for dispersion
}

interface HitResult {
  t: number;
  point: Vec2;
  normal: Vec2; // unit, pointing toward incoming ray side
  n1: number;
  n2: number;
  isReflection: boolean;
}

type ElementType = 'convex-lens' | 'concave-lens' | 'flat-mirror' | 'prism';

// ── Math helpers ─────────────────────────────────────────────────────────────

function vecAdd(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
function vecSub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function vecScale(a: Vec2, s: number): Vec2 { return { x: a.x * s, y: a.y * s }; }
function vecDot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }
function vecLen(a: Vec2): number { return Math.sqrt(a.x * a.x + a.y * a.y); }
function vecNorm(a: Vec2): Vec2 { const l = vecLen(a); return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }; }
function vecPerp(a: Vec2): Vec2 { return { x: -a.y, y: a.x }; }

/** Reflect direction d about normal n (n must be unit) */
function reflect(d: Vec2, n: Vec2): Vec2 {
  const dot = vecDot(d, n);
  return vecSub(d, vecScale(n, 2 * dot));
}

/** Snell's law refraction. Returns null if TIR. */
function refract(d: Vec2, n: Vec2, n1: number, n2: number): Vec2 | null {
  // ensure normal faces incoming ray
  let nn = n;
  if (vecDot(d, n) > 0) nn = vecScale(n, -1);

  const cosI = -vecDot(d, nn);
  const ratio = n1 / n2;
  const sinT2 = ratio * ratio * (1 - cosI * cosI);
  if (sinT2 > 1) return null; // TIR
  const cosT = Math.sqrt(1 - sinT2);
  return vecAdd(vecScale(d, ratio), vecScale(nn, ratio * cosI - cosT));
}

/** Ray–segment intersection. Returns t>0 or -1 */
function raySegment(ro: Vec2, rd: Vec2, p1: Vec2, p2: Vec2): number {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const denom = rd.x * dy - rd.y * dx;
  if (Math.abs(denom) < 1e-9) return -1;
  const t = ((p1.x - ro.x) * dy - (p1.y - ro.y) * dx) / denom;
  const u = ((p1.x - ro.x) * rd.y - (p1.y - ro.y) * rd.x) / denom;
  if (t > 1e-3 && u >= 0 && u <= 1) return t;
  return -1;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function wavelengthToRGB(wl: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
  else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
  else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
  else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
  else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
  else if (wl >= 645 && wl <= 700) { r = 1; }
  let factor = 1;
  if (wl < 420) factor = 0.3 + 0.7 * (wl - 380) / 40;
  else if (wl > 680) factor = 0.3 + 0.7 * (700 - wl) / 20;
  return [Math.round(r * factor * 255), Math.round(g * factor * 255), Math.round(b * factor * 255)];
}

function rayColor(index: number, total: number): { css: string; wavelength: number } {
  const t = total > 1 ? index / (total - 1) : 0.5;
  const wl = 380 + t * 320; // 380–700 nm
  const [r, g, b] = wavelengthToRGB(wl);
  return { css: `rgb(${r},${g},${b})`, wavelength: wl };
}

// ── Lens (thin) ───────────────────────────────────────────────────────────────

/**
 * Model lens as a vertical slab at cx with half-height lensH.
 * Rays passing through are redirected using the thin-lens formula.
 * The "surface" for intersection is a line segment x=cx, y in [cy-lensH, cy+lensH].
 */
function hitThinLens(
  ro: Vec2, rd: Vec2,
  cx: number, cy: number, lensH: number,
  focalLength: number, refractiveIndex: number,
  isConvex: boolean,
): HitResult | null {
  // Intersect with vertical line x = cx
  if (Math.abs(rd.x) < 1e-9) return null;
  const t = (cx - ro.x) / rd.x;
  if (t < 1e-3) return null;
  const py = ro.y + rd.y * t;
  if (Math.abs(py - cy) > lensH) return null;

  const point: Vec2 = { x: cx, y: py };
  // Effective focal length modified by refractive index
  // For a thin lens: 1/f_eff ≈ (n-1) * base_curvature_factor
  const nFactor = (refractiveIndex - 1) / (1.5 - 1); // normalize to n=1.5 reference
  const fEff = isConvex ? focalLength / nFactor : -focalLength / nFactor;

  // Thin-lens deflection: incoming parallel ray at height y_p from axis
  // deflects to pass through focal point.
  // General ray: d'y/d'x = (dy/dx) - y_p / f
  // We need to compute the new direction.
  const yp = py - cy; // height from optical axis
  const incomingSlope = rd.y / rd.x; // dy/dx
  const outgoingSlope = incomingSlope - yp / fEff;

  const outDir = vecNorm({ x: 1, y: outgoingSlope });

  // We encode this as a "fake" refraction event by directly returning new dir
  // We'll handle it specially in the trace loop.
  return {
    t,
    point,
    normal: { x: 1, y: 0 }, // surface normal (vertical lens)
    n1: 1.0,
    n2: 1.0,
    isReflection: false,
    // Stash outgoing direction in a property we'll check
    _thinLensOutDir: outDir,
  } as HitResult & { _thinLensOutDir: Vec2 };
}

// ── Mirror ────────────────────────────────────────────────────────────────────

function hitMirror(
  ro: Vec2, rd: Vec2,
  cx: number, cy: number, mirrorLen: number,
): HitResult | null {
  // Flat mirror: vertical line segment at x=cx, length mirrorLen, centered at cy
  // Actually let's use a 45-degree mirror for more interesting bounce
  // Mirror goes from (cx - mirrorLen/2, cy - mirrorLen/2) to (cx + mirrorLen/2, cy + mirrorLen/2)
  // That makes a 45° line
  const p1: Vec2 = { x: cx - mirrorLen / 2, y: cy - mirrorLen / 2 };
  const p2: Vec2 = { x: cx + mirrorLen / 2, y: cy + mirrorLen / 2 };
  const t = raySegment(ro, rd, p1, p2);
  if (t < 0) return null;

  const point: Vec2 = { x: ro.x + rd.x * t, y: ro.y + rd.y * t };
  // Normal to the 45° line: perpendicular to (1,1) is (-1,1) or (1,-1)
  let normal = vecNorm({ x: -1, y: 1 });
  if (vecDot(rd, normal) > 0) normal = vecScale(normal, -1);

  return { t, point, normal, n1: 1.0, n2: 1.0, isReflection: true };
}

// ── Prism ─────────────────────────────────────────────────────────────────────

interface PrismData {
  vertices: Vec2[];
  n: number;
}

function buildPrism(cx: number, cy: number, apexAngleDeg: number, size: number): PrismData {
  const half = (apexAngleDeg * Math.PI / 180) / 2;
  const h = size * Math.cos(half);
  // Apex at top, base at bottom
  const apex: Vec2 = { x: cx, y: cy - h };
  const left: Vec2 = { x: cx - size * Math.sin(half), y: cy + size * (1 - Math.cos(half)) };
  const right: Vec2 = { x: cx + size * Math.sin(half), y: cy + size * (1 - Math.cos(half)) };
  return { vertices: [apex, right, left], n: 1.5 };
}

function hitPrism(
  ro: Vec2, rd: Vec2,
  prism: PrismData,
  currentN: number,
  refractiveIndex: number,
): HitResult | null {
  const verts = prism.vertices;
  let bestT = Infinity;
  let bestHit: HitResult | null = null;
  const prismN = refractiveIndex;

  for (let i = 0; i < verts.length; i++) {
    const p1 = verts[i];
    const p2 = verts[(i + 1) % verts.length];
    const t = raySegment(ro, rd, p1, p2);
    if (t < 0 || t >= bestT) continue;

    const point: Vec2 = { x: ro.x + rd.x * t, y: ro.y + rd.y * t };
    const edgeDir = vecNorm(vecSub(p2, p1));
    let normal = vecPerp(edgeDir); // one of the two perpendiculars
    // Make normal face toward incoming ray
    if (vecDot(rd, normal) > 0) normal = vecScale(normal, -1);

    // Determine n1, n2 based on whether we're entering or exiting
    // If dot(rd, outward_normal) < 0, we're entering; else exiting
    // outward_normal: points away from prism interior (centroid)
    const centroid: Vec2 = {
      x: (verts[0].x + verts[1].x + verts[2].x) / 3,
      y: (verts[0].y + verts[1].y + verts[2].y) / 3,
    };
    const outward = vecNorm(vecSub(point, centroid));
    const entering = vecDot(rd, outward) < 0;

    const n1 = entering ? 1.0 : prismN;
    const n2 = entering ? prismN : 1.0;
    // Override normal to point into medium we're coming from
    let n = vecNorm(outward);
    if (entering) n = vecScale(n, -1); // inward for entry

    bestT = t;
    bestHit = { t, point, normal: n, n1, n2, isReflection: false };
  }
  return bestHit;
}

// ── Main Simulation ───────────────────────────────────────────────────────────

const MAX_BOUNCES = 8;

export default class RayOpticsSim extends SimulationEngine {
  private elementType: ElementType = 'convex-lens';
  private focalLength = 120;
  private refractiveIndex = 1.5;
  private sourceYPercent = 50;
  private fanAngle = 30;
  private numRays = 9;
  private showNormals = false;
  private showAngles = false;

  // Source drag
  private sourceX = 0;
  private sourceY = 0;
  private dragging = false;

  // Aim direction (always horizontal to right for default)
  private aimAngle = 0;

  setup(): void {
    this.sourceX = this.width * 0.15;
    this.sourceY = this.height * (this.sourceYPercent / 100);
  }

  reset(): void {
    this.elementType = 'convex-lens';
    this.focalLength = 120;
    this.refractiveIndex = 1.5;
    this.sourceYPercent = 50;
    this.fanAngle = 30;
    this.numRays = 9;
    this.showNormals = false;
    this.showAngles = false;
    this.aimAngle = 0;
    this.sourceX = this.width * 0.15;
    this.sourceY = this.height * 0.5;
  }

  update(dt: number): void {
    this.time += dt;
    // Keep source y in sync when sourceYPercent changes via control
    if (!this.dragging) {
      this.sourceY = this.height * (this.sourceYPercent / 100);
    }
  }

  private getElementCenter(): Vec2 {
    return { x: this.width / 2, y: this.height / 2 };
  }

  private traceSingleRay(ray: Ray): { segments: { from: Vec2; to: Vec2; color: string }[]; hitData: { point: Vec2; n1: number; n2: number; normalDir: Vec2 }[] } {
    const segments: { from: Vec2; to: Vec2; color: string }[] = [];
    const hitData: { point: Vec2; n1: number; n2: number; normalDir: Vec2 }[] = [];

    const ec = this.getElementCenter();
    const lensH = 90;
    const mirrorLen = 140;
    const prism = buildPrism(ec.x, ec.y, this.focalLength, 90); // focalLength used as apex angle for prism

    let ro = { ...ray.origin };
    let rd = { ...ray.dir };
    let currentN = 1.0;
    const color = ray.color;

    // For prism, use focalLength slider as apex angle (20–80 deg range)
    // we need to pass the prism built with actual apex angle when type is prism
    const apexAngleDeg = this.elementType === 'prism'
      ? Math.max(20, Math.min(80, this.focalLength))
      : 60;
    const prismShape = buildPrism(ec.x, ec.y, apexAngleDeg, 90);

    for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
      let hit: (HitResult & { _thinLensOutDir?: Vec2 }) | null = null;

      if (this.elementType === 'convex-lens' || this.elementType === 'concave-lens') {
        hit = hitThinLens(ro, rd, ec.x, ec.y, lensH, this.focalLength, this.refractiveIndex, this.elementType === 'convex-lens') as (HitResult & { _thinLensOutDir?: Vec2 });
      } else if (this.elementType === 'flat-mirror') {
        hit = hitMirror(ro, rd, ec.x, ec.y, mirrorLen);
      } else if (this.elementType === 'prism') {
        hit = hitPrism(ro, rd, prismShape, currentN, this.refractiveIndex);
      }

      const maxDist = Math.max(this.width, this.height) * 2;

      if (!hit) {
        // Extend to canvas edge
        const tEnd = this.rayToEdge(ro, rd);
        const endPt = vecAdd(ro, vecScale(rd, tEnd));
        segments.push({ from: { ...ro }, to: endPt, color });
        break;
      }

      // Draw segment to hit point
      segments.push({ from: { ...ro }, to: { ...hit.point }, color });

      if (hit._thinLensOutDir) {
        // Thin lens: just redirect
        hitData.push({ point: hit.point, n1: 1, n2: 1, normalDir: hit.normal });
        ro = vecAdd(hit.point, vecScale(hit._thinLensOutDir, 0.5));
        rd = hit._thinLensOutDir;
        // After lens, continue to edge immediately
        const tEnd = this.rayToEdge(ro, rd);
        const endPt = vecAdd(ro, vecScale(rd, tEnd));
        segments.push({ from: { ...ro }, to: endPt, color });
        break;
      }

      if (hit.isReflection) {
        hitData.push({ point: hit.point, n1: hit.n1, n2: hit.n2, normalDir: hit.normal });
        const newDir = reflect(rd, hit.normal);
        ro = vecAdd(hit.point, vecScale(newDir, 0.5));
        rd = vecNorm(newDir);
        continue;
      }

      // Refraction
      const refracted = refract(rd, hit.normal, hit.n1, hit.n2);
      if (!refracted) {
        // TIR
        hitData.push({ point: hit.point, n1: hit.n1, n2: hit.n2, normalDir: hit.normal });
        const newDir = reflect(rd, hit.normal);
        ro = vecAdd(hit.point, vecScale(newDir, 0.5));
        rd = vecNorm(newDir);
        continue;
      }

      hitData.push({ point: hit.point, n1: hit.n1, n2: hit.n2, normalDir: hit.normal });
      currentN = hit.n2;
      ro = vecAdd(hit.point, vecScale(refracted, 0.5));
      rd = vecNorm(refracted);
    }

    return { segments, hitData };
  }

  private rayToEdge(ro: Vec2, rd: Vec2): number {
    const { width, height } = this;
    const candidates: number[] = [];
    if (Math.abs(rd.x) > 1e-9) {
      candidates.push((width - ro.x) / rd.x);
      candidates.push((0 - ro.x) / rd.x);
    }
    if (Math.abs(rd.y) > 1e-9) {
      candidates.push((height - ro.y) / rd.y);
      candidates.push((0 - ro.y) / rd.y);
    }
    const valid = candidates.filter(t => t > 1e-3);
    return valid.length > 0 ? Math.min(...valid) : 1000;
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#09090b');
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.04)');

    const ec = this.getElementCenter();

    // Draw optical axis (dashed)
    drawDashedLine(ctx, 0, ec.y, width, ec.y, 'rgba(255,255,255,0.12)', 1, [8, 6]);

    // Draw element
    this.drawElement(ec);

    // Build rays
    const rays = this.buildRays();

    // Trace and draw each ray
    const allHitData: { point: Vec2; n1: number; n2: number; normalDir: Vec2 }[] = [];
    for (const ray of rays) {
      const { segments, hitData } = this.traceSingleRay(ray);
      allHitData.push(...hitData);

      for (const seg of segments) {
        const dx = seg.to.x - seg.from.x;
        const dy = seg.to.y - seg.from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;

        // Glow pass
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(seg.from.x, seg.from.y);
        ctx.lineTo(seg.to.x, seg.to.y);
        ctx.strokeStyle = seg.color.replace('rgb(', 'rgba(').replace(')', ',0.18)');
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.restore();

        // Main ray
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(seg.from.x, seg.from.y);
        ctx.lineTo(seg.to.x, seg.to.y);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw normals
    if (this.showNormals) {
      for (const hd of allHitData) {
        const nLen = 25;
        const nx = hd.point.x + hd.normalDir.x * nLen;
        const ny = hd.point.y + hd.normalDir.y * nLen;
        drawDashedLine(ctx, hd.point.x, hd.point.y, nx, ny, 'rgba(255,255,255,0.5)', 1, [4, 3]);
      }
    }

    // Draw angles
    if (this.showAngles && allHitData.length > 0) {
      const seen = new Set<string>();
      for (const hd of allHitData) {
        const key = `${Math.round(hd.point.x)},${Math.round(hd.point.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const theta1 = Math.acos(Math.min(1, Math.abs(vecDot({ x: 0, y: -1 }, hd.normalDir)))) * 180 / Math.PI;
        const n1 = hd.n1.toFixed(2);
        const n2 = hd.n2.toFixed(2);
        drawText(ctx, `θ₁=${theta1.toFixed(0)}°`, hd.point.x + 10, hd.point.y - 14, '#fde68a', '10px monospace');
        drawText(ctx, `n₁=${n1} n₂=${n2}`, hd.point.x + 10, hd.point.y, '#94a3b8', '9px monospace');
      }
    }

    // Draw light source
    this.drawSource();

    // Draw focal point for lenses
    if (this.elementType === 'convex-lens' || this.elementType === 'concave-lens') {
      const fSign = this.elementType === 'convex-lens' ? 1 : -1;
      const nFactor = (this.refractiveIndex - 1) / (1.5 - 1);
      const fEff = fSign * this.focalLength / nFactor;
      const fx = ec.x + fEff;
      const fy = ec.y;

      // Glow
      const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 12);
      grad.addColorStop(0, 'rgba(251,191,36,0.8)');
      grad.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.beginPath();
      ctx.arc(fx, fy, 12, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      drawText(ctx, 'F', fx + 8, fy - 8, '#fbbf24', 'bold 11px system-ui');

      // Secondary focal (object side)
      const fx2 = ec.x - fEff;
      ctx.beginPath();
      ctx.arc(fx2, ec.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,0.5)';
      ctx.fill();
      drawText(ctx, "F'", fx2 + 8, ec.y - 8, 'rgba(251,191,36,0.6)', '11px system-ui');
    }

    // Info panel
    ctx.fillStyle = 'rgba(9,9,11,0.85)';
    ctx.fillRect(10, 10, 200, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 200, 64);
    const elementLabel: Record<ElementType, string> = {
      'convex-lens': 'Convex Lens', 'concave-lens': 'Concave Lens',
      'flat-mirror': 'Flat Mirror (45°)', 'prism': 'Glass Prism',
    };
    drawText(ctx, elementLabel[this.elementType], 20, 28, '#e2e8f0', 'bold 12px system-ui');
    drawText(ctx, `n = ${this.refractiveIndex.toFixed(2)}`, 20, 46, '#94a3b8', '11px monospace');
    drawText(ctx, this.elementType === 'prism'
      ? `apex = ${this.focalLength.toFixed(0)}°`
      : `f = ${this.focalLength.toFixed(0)} px`, 20, 62, '#94a3b8', '11px monospace');

    drawText(ctx, 'Drag source to move', width / 2, height - 14, '#475569', '11px system-ui', 'center');
  }

  private buildRays(): Ray[] {
    const rays: Ray[] = [];
    const n = this.numRays;
    const halfAngle = (this.fanAngle * Math.PI) / 180 / 2;

    for (let i = 0; i < n; i++) {
      const { css, wavelength } = rayColor(i, n);
      const t = n > 1 ? i / (n - 1) : 0.5;
      const angle = this.aimAngle + (-1 + 2 * t) * halfAngle;
      const dir = vecNorm({ x: Math.cos(angle), y: Math.sin(angle) });
      rays.push({
        origin: { x: this.sourceX, y: this.sourceY },
        dir,
        color: css,
        wavelength,
      });
    }
    return rays;
  }

  private drawSource(): void {
    const { ctx } = this;
    const sx = this.sourceX, sy = this.sourceY;

    // Glow
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
    glow.addColorStop(0, 'rgba(255,240,100,0.6)');
    glow.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Star shape
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    const points = 5;
    const outerR = 9, innerR = 4;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / points - Math.PI / 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawElement(ec: Vec2): void {
    const { ctx } = this;
    const lensH = 90;
    const mirrorLen = 140;

    ctx.save();
    if (this.elementType === 'convex-lens') {
      // Draw convex lens shape (double-convex)
      const lw = 18; // lens half-width at center
      ctx.beginPath();
      ctx.moveTo(ec.x, ec.y - lensH);
      // Left arc
      ctx.bezierCurveTo(ec.x + lw * 1.5, ec.y - lensH * 0.5, ec.x + lw * 1.5, ec.y + lensH * 0.5, ec.x, ec.y + lensH);
      ctx.bezierCurveTo(ec.x - lw * 1.5, ec.y + lensH * 0.5, ec.x - lw * 1.5, ec.y - lensH * 0.5, ec.x, ec.y - lensH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(56,189,248,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrows on top and bottom
      this.drawLensArrows(ec, lensH, true);
    } else if (this.elementType === 'concave-lens') {
      // Concave (diverging) lens: thick at edges, thin in the middle
      const edgeW = 14; // half-width at top/bottom (thick parts)
      const pinch = 10; // how much the middle pinches inward
      ctx.beginPath();
      // Top edge
      ctx.moveTo(ec.x - edgeW, ec.y - lensH);
      ctx.lineTo(ec.x + edgeW, ec.y - lensH);
      // Right side curves inward
      ctx.bezierCurveTo(
        ec.x + edgeW - pinch, ec.y - lensH * 0.35,
        ec.x + edgeW - pinch, ec.y + lensH * 0.35,
        ec.x + edgeW, ec.y + lensH
      );
      // Bottom edge
      ctx.lineTo(ec.x - edgeW, ec.y + lensH);
      // Left side curves inward
      ctx.bezierCurveTo(
        ec.x - edgeW + pinch, ec.y + lensH * 0.35,
        ec.x - edgeW + pinch, ec.y - lensH * 0.35,
        ec.x - edgeW, ec.y - lensH
      );
      ctx.closePath();
      ctx.fillStyle = 'rgba(56,189,248,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      this.drawLensArrows(ec, lensH, false);
    } else if (this.elementType === 'flat-mirror') {
      const hLen = mirrorLen / 2;
      // 45° mirror line
      ctx.beginPath();
      ctx.moveTo(ec.x - hLen, ec.y - hLen);
      ctx.lineTo(ec.x + hLen, ec.y + hLen);
      ctx.strokeStyle = 'rgba(148,163,184,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Hatching on back of mirror
      ctx.strokeStyle = 'rgba(100,116,139,0.4)';
      ctx.lineWidth = 1;
      for (let d = -hLen; d <= hLen; d += 10) {
        const x1 = ec.x + d, y1 = ec.y + d;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + 8, y1 + 8);
        ctx.stroke();
      }

      drawText(ctx, '45°', ec.x + hLen / 2 + 14, ec.y + hLen / 2, '#94a3b8', '11px monospace');
    } else if (this.elementType === 'prism') {
      const apexAngleDeg = Math.max(20, Math.min(80, this.focalLength));
      const prism = buildPrism(ec.x, ec.y, apexAngleDeg, 90);
      const verts = prism.vertices;

      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(134,239,172,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(134,239,172,0.65)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawText(ctx, `n=${this.refractiveIndex.toFixed(2)}`, ec.x, ec.y + 30, 'rgba(134,239,172,0.7)', '10px monospace', 'center');
    }
    ctx.restore();
  }

  private drawLensArrows(ec: Vec2, lensH: number, convex: boolean): void {
    const { ctx } = this;
    const dir = convex ? 1 : -1;
    const aw = 8;
    // Top arrow
    ctx.beginPath();
    ctx.moveTo(ec.x, ec.y - lensH);
    ctx.lineTo(ec.x - aw * dir, ec.y - lensH + aw * 1.5);
    ctx.lineTo(ec.x + aw * dir, ec.y - lensH + aw * 1.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56,189,248,0.7)';
    ctx.fill();
    // Bottom arrow
    ctx.beginPath();
    ctx.moveTo(ec.x, ec.y + lensH);
    ctx.lineTo(ec.x - aw * dir, ec.y + lensH - aw * 1.5);
    ctx.lineTo(ec.x + aw * dir, ec.y + lensH - aw * 1.5);
    ctx.closePath();
    ctx.fill();
  }

  onPointerDown(x: number, y: number): void {
    const dx = x - this.sourceX, dy = y - this.sourceY;
    if (dx * dx + dy * dy < 400) this.dragging = true;
  }

  onPointerMove(x: number, y: number): void {
    if (this.dragging) {
      this.sourceX = Math.max(10, Math.min(this.width - 10, x));
      this.sourceY = Math.max(10, Math.min(this.height - 10, y));
      this.sourceYPercent = (this.sourceY / this.height) * 100;
    }
  }

  onPointerUp(_x: number, _y: number): void {
    this.dragging = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown', key: 'elementType', label: 'Optical Element',
        options: [
          { value: 'convex-lens', label: 'Convex Lens' },
          { value: 'concave-lens', label: 'Concave Lens' },
          { value: 'flat-mirror', label: 'Flat Mirror' },
          { value: 'prism', label: 'Glass Prism' },
        ],
        defaultValue: 'convex-lens',
      },
      { type: 'slider', key: 'focalLength', label: 'Focal Length / Apex Angle', min: 20, max: 300, step: 5, defaultValue: 120, unit: 'px/°' },
      { type: 'slider', key: 'refractiveIndex', label: 'Refractive Index', min: 1.0, max: 2.5, step: 0.05, defaultValue: 1.5 },
      { type: 'slider', key: 'sourceYPercent', label: 'Source Height', min: 5, max: 95, step: 1, defaultValue: 50, unit: '%' },
      { type: 'slider', key: 'fanAngle', label: 'Fan Angle', min: 5, max: 60, step: 1, defaultValue: 30, unit: '°' },
      { type: 'slider', key: 'numRays', label: 'Number of Rays', min: 3, max: 21, step: 2, defaultValue: 9 },
      { type: 'toggle', key: 'showNormals', label: 'Show Normals', defaultValue: false },
      { type: 'toggle', key: 'showAngles', label: 'Show Angles', defaultValue: false },
      { type: 'button', key: 'reset', label: 'Reset' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      elementType: this.elementType,
      focalLength: this.focalLength,
      refractiveIndex: this.refractiveIndex,
      sourceYPercent: this.sourceYPercent,
      fanAngle: this.fanAngle,
      numRays: this.numRays,
      showNormals: this.showNormals,
      showAngles: this.showAngles,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'elementType': this.elementType = value as ElementType; break;
      case 'focalLength': this.focalLength = value as number; break;
      case 'refractiveIndex': this.refractiveIndex = value as number; break;
      case 'sourceYPercent':
        this.sourceYPercent = value as number;
        this.sourceY = this.height * ((value as number) / 100);
        break;
      case 'fanAngle': this.fanAngle = value as number; break;
      case 'numRays': this.numRays = value as number; break;
      case 'showNormals': this.showNormals = value as boolean; break;
      case 'showAngles': this.showAngles = value as boolean; break;
      case 'reset': this.reset(); break;
    }
  }
}

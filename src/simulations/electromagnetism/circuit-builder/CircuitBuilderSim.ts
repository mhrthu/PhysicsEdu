import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import { Vector2 } from '@/engine/math/Vector2.ts';
import { clearCanvas, drawText } from '@/engine/render/drawUtils.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

type ComponentType = 'wire' | 'resistor' | 'battery' | 'led' | 'switch' | 'ac-source';

interface CircuitComponent {
  type: ComponentType;
  gridStart: Vector2;
  gridEnd: Vector2;
  value: number;       // Ω for resistor, V for battery/ac-source, ignored for others
  closed?: boolean;    // for switch
  id: number;
}

const GRID_SIZE = 40;
const NODE_RADIUS = 5;
let _idCounter = 0;

// LED forward voltage and forward resistance
const LED_VF = 2.0;   // volts
const LED_RF = 30;    // ohms (series resistance when conducting)

export default class CircuitBuilderSim extends SimulationEngine {
  private components: CircuitComponent[] = [];
  private componentType: ComponentType = 'resistor';
  private componentValue: number = 100;
  private showCurrentFlow: boolean = true;
  private showNodeVoltages: boolean = true;
  private placingStart: Vector2 | null = null;
  private hoverGrid: Vector2 | null = null;

  // Solved state
  private totalCurrent: number = 0;
  private isAC: boolean = false;
  private nodeVoltages: Map<string, number> = new Map();
  private currentDotOffset: number = 0;
  private loopComponentIds: Set<number> = new Set();
  // true = current flows gridStart→gridEnd, false = gridEnd→gridStart
  private currentDirection: Map<number, boolean> = new Map();

  setup(): void {
    this.components = [];
    // Default demo: 2 resistors in parallel (rectangular layout)
    //
    //   (2,2)------R1 (100Ω)-------(8,2)
    //     |                           |
    //   (2,5)------R2 (100Ω)-------(8,5)
    //     |                           |
    //   (2,7)---Battery (100V)------(8,7)
    //     +                           -
    //
    const mk = (type: ComponentType, sx: number, sy: number, ex: number, ey: number, value = 0, closed?: boolean): CircuitComponent =>
      ({ type, gridStart: new Vector2(sx, sy), gridEnd: new Vector2(ex, ey), value, closed, id: _idCounter++ });

    this.components.push(mk('battery', 2, 7, 8, 7, 100));   // Battery: + at (2,7), - at (8,7)
    this.components.push(mk('wire', 2, 7, 2, 5, 0));        // Left side: battery+ up to R2
    this.components.push(mk('wire', 2, 5, 2, 2, 0));        // Continue up to R1
    this.components.push(mk('resistor', 2, 2, 8, 2, 100));  // R1 across top
    this.components.push(mk('resistor', 2, 5, 8, 5, 100));  // R2 across middle
    this.components.push(mk('wire', 8, 2, 8, 5, 0));        // Right side: R1 down to R2
    this.components.push(mk('wire', 8, 5, 8, 7, 0));        // Continue down to battery-

    this.solveCircuit();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.isAC) {
      // AC: oscillate dot offset sinusoidally
      const acFreq = 1; // Hz display freq
      this.currentDotOffset = (Math.sin(this.time * acFreq * 2 * Math.PI) * 0.5 + 0.5) * GRID_SIZE;
    } else {
      this.currentDotOffset = (this.currentDotOffset + dt * Math.abs(this.totalCurrent) * 80) % GRID_SIZE;
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    this.renderSnapGrid();

    for (const comp of this.components) {
      this.renderComponent(comp);
    }

    if (this.showCurrentFlow && Math.abs(this.totalCurrent) > 0.001) {
      this.renderCurrentFlow();
    }

    if (this.showNodeVoltages) {
      this.renderNodeVoltages();
    }

    if (this.placingStart && this.hoverGrid) {
      this.renderPlacementPreview();
    }

    this.renderInfoPanel();

    drawText(ctx, 'Click grid intersections to place components (start \u2192 end)',
      width / 2, height - 16, 'rgba(148,163,184,0.5)', '12px system-ui', 'center');
  }

  // ── Grid helpers ──────────────────────────────────────────────────────────────

  private renderSnapGrid(): void {
    const { ctx, width, height } = this;
    const ox = (width % GRID_SIZE) / 2;
    const oy = (height % GRID_SIZE) / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(148,163,184,0.06)';
    ctx.lineWidth = 1;
    for (let x = ox; x <= width; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = oy; y <= height; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(148,163,184,0.2)';
    for (let x = ox; x <= width; x += GRID_SIZE) {
      for (let y = oy; y <= height; y += GRID_SIZE) {
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  private gridToPixel(g: Vector2): Vector2 {
    const ox = (this.width % GRID_SIZE) / 2;
    const oy = (this.height % GRID_SIZE) / 2;
    return new Vector2(g.x * GRID_SIZE + ox, g.y * GRID_SIZE + oy);
  }

  private pixelToGrid(px: number, py: number): Vector2 {
    const ox = (this.width % GRID_SIZE) / 2;
    const oy = (this.height % GRID_SIZE) / 2;
    return new Vector2(Math.round((px - ox) / GRID_SIZE), Math.round((py - oy) / GRID_SIZE));
  }

  // ── Component rendering ───────────────────────────────────────────────────────

  private renderComponent(comp: CircuitComponent): void {
    const { ctx } = this;
    const p1 = this.gridToPixel(comp.gridStart);
    const p2 = this.gridToPixel(comp.gridEnd);
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const nx = dx / len, ny = dy / len;
    const px = -ny, py = nx; // perpendicular

    ctx.save();

    switch (comp.type) {
      case 'wire':
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        break;

      case 'resistor': {
        this.drawLeadWires(ctx, p1, p2, nx, ny, len);
        const numZigs = 6;
        const zigStart = p1.x + nx * len * 0.25, zigStartY = p1.y + ny * len * 0.25;
        const zigLen = len * 0.5;
        const zigStep = zigLen / numZigs;
        const zigAmp = 8;
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(zigStart, zigStartY);
        for (let i = 0; i < numZigs; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          ctx.lineTo(zigStart + nx * zigStep * (i + 0.5) + px * zigAmp * side,
                     zigStartY + ny * zigStep * (i + 0.5) + py * zigAmp * side);
        }
        ctx.lineTo(p1.x + nx * len * 0.75, p1.y + ny * len * 0.75);
        ctx.stroke();
        drawText(ctx, `${comp.value}\u03A9`, mx + px * 20, my + py * 20, '#fbbf24', '12px system-ui', 'center');
        break;
      }

      case 'battery':
      case 'ac-source': {
        this.drawLeadWires(ctx, p1, p2, nx, ny, len);
        if (comp.type === 'battery') {
          // Long line (+) and short line (-)
          const c1 = new Vector2(p1.x + nx * len * 0.45, p1.y + ny * len * 0.45);
          const c2 = new Vector2(p1.x + nx * len * 0.55, p1.y + ny * len * 0.55);
          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(c1.x + px * 12, c1.y + py * 12);
          ctx.lineTo(c1.x - px * 12, c1.y - py * 12); ctx.stroke();
          ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(c2.x + px * 7, c2.y + py * 7);
          ctx.lineTo(c2.x - px * 7, c2.y - py * 7); ctx.stroke();
          drawText(ctx, '+', c1.x + px * 18, c1.y + py * 18, '#22c55e', '10px system-ui', 'center');
          drawText(ctx, '\u2212', c2.x + px * 14, c2.y + py * 14, '#ef4444', '10px system-ui', 'center');
          drawText(ctx, `${comp.value}V`, mx + px * 22, my + py * 22, '#4ade80', '12px system-ui', 'center');
        } else {
          // AC circle symbol
          const cr = 14;
          ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(mx, my, cr, 0, Math.PI * 2); ctx.stroke();
          // Sine wave inside
          ctx.beginPath();
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const sx = mx + px * cr * (2 * t - 1);
            const sy = my + py * cr * (2 * t - 1) + Math.sin(t * Math.PI * 2) * 6;
            if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          }
          ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.5; ctx.stroke();
          drawText(ctx, `~${comp.value}V`, mx + px * 26, my + py * 26, '#a78bfa', '12px system-ui', 'center');
        }
        break;
      }

      case 'led': {
        this.drawLeadWires(ctx, p1, p2, nx, ny, len);
        const conducting = Math.abs(this.totalCurrent) > 0.001 && this.loopComponentIds.has(comp.id);
        const ledColor = conducting ? '#22d3ee' : '#164e63';

        // Triangle pointing toward p2
        const triBase = new Vector2(p1.x + nx * len * 0.4, p1.y + ny * len * 0.4);
        const triTip  = new Vector2(p1.x + nx * len * 0.6, p1.y + ny * len * 0.6);
        const s = 10;
        ctx.fillStyle = ledColor;
        ctx.beginPath();
        ctx.moveTo(triTip.x, triTip.y);
        ctx.lineTo(triBase.x + px * s, triBase.y + py * s);
        ctx.lineTo(triBase.x - px * s, triBase.y - py * s);
        ctx.closePath(); ctx.fill();

        // Cathode bar
        ctx.strokeStyle = ledColor; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(triTip.x + px * 10, triTip.y + py * 10);
        ctx.lineTo(triTip.x - px * 10, triTip.y - py * 10);
        ctx.stroke();

        // Glow when conducting
        if (conducting) {
          const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 20);
          glow.addColorStop(0, 'rgba(34,211,238,0.5)');
          glow.addColorStop(1, 'rgba(34,211,238,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(mx, my, 20, 0, Math.PI * 2); ctx.fill();
        }

        drawText(ctx, 'LED', mx + px * 20, my + py * 20,
          conducting ? '#22d3ee' : '#164e63', '11px system-ui', 'center');
        break;
      }

      case 'switch': {
        this.drawLeadWires(ctx, p1, p2, nx, ny, len);
        const closed = comp.closed ?? false;
        const pivotX = p1.x + nx * len * 0.3, pivotY = p1.y + ny * len * 0.3;
        const tipX   = p1.x + nx * len * 0.7, tipY   = p1.y + ny * len * 0.7;

        ctx.strokeStyle = closed ? '#22c55e' : '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        if (closed) {
          ctx.lineTo(tipX, tipY);
        } else {
          // Lifted arm (30° angle upward)
          const openAngle = -Math.PI / 5;
          const armLen = len * 0.4;
          const cosA = Math.cos(openAngle), sinA = Math.sin(openAngle);
          const armDx = nx * armLen * cosA - ny * armLen * sinA;
          const armDy = nx * armLen * sinA + ny * armLen * cosA;
          ctx.lineTo(pivotX + armDx, pivotY + armDy);
        }
        ctx.stroke();

        // Pivot dot
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath(); ctx.arc(pivotX, pivotY, 3.5, 0, Math.PI * 2); ctx.fill();
        // End dot
        ctx.beginPath(); ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2); ctx.fill();

        drawText(ctx, closed ? 'ON' : 'OFF', mx + px * 18, my + py * 18,
          closed ? '#22c55e' : '#94a3b8', '11px system-ui', 'center');
        break;
      }
    }

    // Node dots
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath(); ctx.arc(p1.x, p1.y, NODE_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p2.x, p2.y, NODE_RADIUS, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  private drawLeadWires(
    ctx: CanvasRenderingContext2D,
    p1: Vector2, p2: Vector2,
    nx: number, ny: number, len: number,
  ): void {
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + nx * len * 0.25, p1.y + ny * len * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p1.x + nx * len * 0.75, p1.y + ny * len * 0.75);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // ── MNA Circuit Solver ──────────────────────────────────────────────────────
  // Uses Modified Nodal Analysis to solve arbitrary circuit topologies
  // (series, parallel, multi-loop, multi-source).
  // Reference: https://cheever.domains.swarthmore.edu/Ref/mna/MNA3.html

  /** Union-Find: find root of node */
  private ufParent = new Map<string, string>();
  private ufFind(a: string): string {
    if (!this.ufParent.has(a)) this.ufParent.set(a, a);
    if (this.ufParent.get(a) !== a) this.ufParent.set(a, this.ufFind(this.ufParent.get(a)!));
    return this.ufParent.get(a)!;
  }
  private ufUnion(a: string, b: string): void {
    this.ufParent.set(this.ufFind(a), this.ufFind(b));
  }

  private solveCircuit(): void {
    this.totalCurrent = 0;
    this.isAC = false;
    this.nodeVoltages.clear();
    this.loopComponentIds.clear();

    if (this.components.length === 0) return;

    // Step 1: Merge nodes connected by wires / closed switches (Union-Find)
    this.ufParent.clear();
    const allKeys = new Set<string>();
    for (const comp of this.components) {
      const k1 = `${comp.gridStart.x},${comp.gridStart.y}`;
      const k2 = `${comp.gridEnd.x},${comp.gridEnd.y}`;
      allKeys.add(k1); allKeys.add(k2);
      if (comp.type === 'wire' || (comp.type === 'switch' && comp.closed)) {
        this.ufUnion(k1, k2);
      }
    }

    // Step 2: Assign integer indices to merged super-nodes
    const rootToIdx = new Map<string, number>();
    let nNodes = 0;
    for (const key of allKeys) {
      const root = this.ufFind(key);
      if (!rootToIdx.has(root)) rootToIdx.set(root, nNodes++);
    }
    const idx = (key: string) => rootToIdx.get(this.ufFind(key))!;

    // Step 3: Classify components
    type VS = { comp: CircuitComponent; nPos: number; nNeg: number; v: number };
    type R  = { comp: CircuitComponent; n1: number; n2: number; r: number };
    const vSources: VS[] = [];
    const resistors: R[] = [];

    for (const comp of this.components) {
      const k1 = `${comp.gridStart.x},${comp.gridStart.y}`;
      const k2 = `${comp.gridEnd.x},${comp.gridEnd.y}`;
      const n1 = idx(k1), n2 = idx(k2);
      if (n1 === n2) continue; // wire / closed switch → already merged

      switch (comp.type) {
        case 'battery':
          vSources.push({ comp, nPos: n1, nNeg: n2, v: comp.value });
          break;
        case 'ac-source':
          vSources.push({ comp, nPos: n1, nNeg: n2, v: comp.value });
          this.isAC = true;
          break;
        case 'resistor':
          resistors.push({ comp, n1, n2, r: comp.value });
          break;
        case 'led':
          resistors.push({ comp, n1, n2, r: LED_RF });
          break;
        // open switch: ignored
        default: break;
      }
    }

    if (vSources.length === 0) return;

    // Step 4: Ground = negative terminal of first voltage source
    const gnd = vSources[0].nNeg;

    // Re-index nodes, removing ground
    const old2new = new Map<number, number>();
    let ni = 0;
    for (let i = 0; i < nNodes; i++) {
      if (i !== gnd) old2new.set(i, ni++);
    }
    const n = ni; // non-ground node count
    const m = vSources.length;
    const sz = n + m;

    // Step 5: Build MNA matrix A and vector z
    const A: number[][] = Array.from({ length: sz }, () => Array(sz).fill(0));
    const z: number[] = Array(sz).fill(0);

    // Stamp resistors into G sub-matrix (upper-left n×n)
    for (const { n1, n2, r } of resistors) {
      const g = 1 / r;
      const i = old2new.get(n1), j = old2new.get(n2);
      if (i !== undefined) A[i][i] += g;
      if (j !== undefined) A[j][j] += g;
      if (i !== undefined && j !== undefined) { A[i][j] -= g; A[j][i] -= g; }
    }

    // Stamp voltage sources into B, C, D sub-matrices
    for (let k = 0; k < m; k++) {
      const { nPos, nNeg, v } = vSources[k];
      const i = old2new.get(nPos), j = old2new.get(nNeg);
      if (i !== undefined) { A[i][n + k] += 1; A[n + k][i] += 1; }
      if (j !== undefined) { A[j][n + k] -= 1; A[n + k][j] -= 1; }
      z[n + k] = v;
    }

    // Step 6: Gaussian elimination with partial pivoting
    const x = this.gaussSolve(A, z, sz);
    if (!x) return;

    // Step 7: Extract node voltages
    const voltByNode = new Float64Array(nNodes);
    for (let i = 0; i < nNodes; i++) {
      if (i === gnd) continue;
      voltByNode[i] = x[old2new.get(i)!];
    }

    // Map voltages to grid keys
    for (const key of allKeys) {
      this.nodeVoltages.set(key, voltByNode[idx(key)]);
    }

    // Step 8: Compute current through each component
    let maxI = 0;
    for (let k = 0; k < m; k++) maxI = Math.max(maxI, Math.abs(x[n + k]));
    this.totalCurrent = maxI;

    // Mark active components
    for (const { comp, n1, n2, r } of resistors) {
      const current = Math.abs(voltByNode[n1] - voltByNode[n2]) / r;
      if (current > 0.001) this.loopComponentIds.add(comp.id);
    }
    for (const { comp } of vSources) {
      this.loopComponentIds.add(comp.id);
    }
    for (const comp of this.components) {
      if (comp.type !== 'wire' && !(comp.type === 'switch' && comp.closed)) continue;
      const v = voltByNode[idx(`${comp.gridStart.x},${comp.gridStart.y}`)];
      if (Math.abs(v) > 0.001) this.loopComponentIds.add(comp.id);
    }

    // Step 9: Compute current flow DIRECTION for animation
    // BFS from battery+ terminal — current flows away from battery+ through circuit
    this.currentDirection.clear();
    const srcComp = vSources[0].comp;
    const battPosKey = `${srcComp.gridStart.x},${srcComp.gridStart.y}`;

    const dist = new Map<string, number>();
    dist.set(battPosKey, 0);
    const bfsQ = [battPosKey];
    while (bfsQ.length > 0) {
      const cur = bfsQ.shift()!;
      const d = dist.get(cur)!;
      for (const comp of this.components) {
        if (!this.loopComponentIds.has(comp.id)) continue;
        if (comp.type === 'battery' || comp.type === 'ac-source') continue;
        if (comp.type === 'switch' && !comp.closed) continue;
        const ck1 = `${comp.gridStart.x},${comp.gridStart.y}`;
        const ck2 = `${comp.gridEnd.x},${comp.gridEnd.y}`;
        if (ck1 === cur && !dist.has(ck2)) { dist.set(ck2, d + 1); bfsQ.push(ck2); }
        if (ck2 === cur && !dist.has(ck1)) { dist.set(ck1, d + 1); bfsQ.push(ck1); }
      }
    }

    for (const comp of this.components) {
      if (!this.loopComponentIds.has(comp.id)) continue;
      const ck1 = `${comp.gridStart.x},${comp.gridStart.y}`;
      const ck2 = `${comp.gridEnd.x},${comp.gridEnd.y}`;
      if (comp.type === 'battery' || comp.type === 'ac-source') {
        // Inside battery: current flows from − to + (gridEnd → gridStart)
        this.currentDirection.set(comp.id, false);
      } else {
        // Current flows from closer-to-battery+ toward farther (toward battery−)
        const d1 = dist.get(ck1) ?? 999;
        const d2 = dist.get(ck2) ?? 999;
        this.currentDirection.set(comp.id, d1 <= d2);
      }
    }
  }

  /** Solve Ax = z via Gaussian elimination with partial pivoting */
  private gaussSolve(A: number[][], z: number[], n: number): number[] | null {
    // Augmented matrix [A|z]
    const M = A.map((row, i) => [...row, z[i]]);

    for (let col = 0; col < n; col++) {
      // Partial pivot
      let maxRow = col, maxVal = Math.abs(M[col][col]);
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(M[row][col]) > maxVal) { maxVal = Math.abs(M[row][col]); maxRow = row; }
      }
      if (maxVal < 1e-12) return null; // singular
      if (maxRow !== col) { const tmp = M[col]; M[col] = M[maxRow]; M[maxRow] = tmp; }

      // Eliminate below
      for (let row = col + 1; row < n; row++) {
        const factor = M[row][col] / M[col][col];
        for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
      }
    }

    // Back-substitution
    const x = new Array(n).fill(0);
    for (let row = n - 1; row >= 0; row--) {
      let sum = M[row][n];
      for (let j = row + 1; j < n; j++) sum -= M[row][j] * x[j];
      x[row] = sum / M[row][row];
    }
    return x;
  }

  // ── Current flow animation ────────────────────────────────────────────────────

  private renderCurrentFlow(): void {
    const { ctx } = this;
    if (Math.abs(this.totalCurrent) < 0.001) return;

    for (const comp of this.components) {
      if (!this.loopComponentIds.has(comp.id)) continue;
      if (comp.type === 'switch' && !comp.closed) continue;

      const p1 = this.gridToPixel(comp.gridStart);
      const p2 = this.gridToPixel(comp.gridEnd);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      // Use precomputed BFS-based direction
      const startToEnd = this.currentDirection.get(comp.id) ?? true;
      const sx = startToEnd ? p1.x : p2.x;
      const sy = startToEnd ? p1.y : p2.y;
      const ex = startToEnd ? p2.x : p1.x;
      const ey = startToEnd ? p2.y : p1.y;
      const fnx = (ex - sx) / len, fny = (ey - sy) / len;

      const numDots = Math.max(2, Math.floor(len / 20));
      ctx.fillStyle = this.isAC ? '#a78bfa' : '#facc15';

      for (let i = 0; i < numDots; i++) {
        const t = ((i / numDots) + this.currentDotOffset / len) % 1;
        ctx.beginPath();
        ctx.arc(sx + fnx * len * t, sy + fny * len * t, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderNodeVoltages(): void {
    for (const [key, voltage] of this.nodeVoltages) {
      const [gx, gy] = key.split(',').map(Number);
      const p = this.gridToPixel(new Vector2(gx, gy));
      drawText(this.ctx, `${voltage.toFixed(1)}V`, p.x, p.y - 14,
        'rgba(74,222,128,0.7)', '10px system-ui', 'center');
    }
  }

  private renderPlacementPreview(): void {
    if (!this.placingStart || !this.hoverGrid) return;
    const { ctx } = this;
    const p1 = this.gridToPixel(this.placingStart);
    const p2 = this.gridToPixel(this.hoverGrid);

    ctx.save();
    ctx.strokeStyle = 'rgba(250,204,21,0.5)'; ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private renderInfoPanel(): void {
    const { ctx, width } = this;
    drawText(ctx, `Components: ${this.components.length}`, 14, 14, '#94a3b8', '13px system-ui', 'left');

    if (Math.abs(this.totalCurrent) > 0.0001) {
      const mA = this.totalCurrent * 1000;
      const label = this.isAC ? '~' : '';
      const currentStr = this.totalCurrent >= 1
        ? `I = ${label}${this.totalCurrent.toFixed(2)} A`
        : `I = ${label}${mA.toFixed(1)} mA`;
      drawText(ctx, currentStr, width / 2, 14, '#facc15', 'bold 16px system-ui', 'center');
    } else if (this.components.length > 0) {
      drawText(ctx, 'Open circuit', width / 2, 14, '#64748b', '14px system-ui', 'center');
    }

    drawText(ctx, `Placing: ${this.componentType}`, width - 14, 14, '#94a3b8', '13px system-ui', 'right');
  }

  // ── Pointer interaction ───────────────────────────────────────────────────────

  onPointerDown(x: number, y: number): void {
    const grid = this.pixelToGrid(x, y);

    // Check if clicking a switch to toggle it
    for (const comp of this.components) {
      if (comp.type !== 'switch') continue;
      const p1 = this.gridToPixel(comp.gridStart);
      const p2 = this.gridToPixel(comp.gridEnd);
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      if ((x - mx) ** 2 + (y - my) ** 2 < 400) {
        comp.closed = !comp.closed;
        this.solveCircuit();
        return;
      }
    }

    if (!this.placingStart) {
      this.placingStart = grid;
    } else {
      if (grid.x !== this.placingStart.x || grid.y !== this.placingStart.y) {
        this.components.push({
          type: this.componentType,
          gridStart: this.placingStart,
          gridEnd: grid,
          value: this.componentValue,
          closed: this.componentType === 'switch' ? false : undefined,
          id: _idCounter++,
        });
        this.solveCircuit();
      }
      this.placingStart = null;
    }
  }

  onPointerMove(x: number, y: number): void {
    this.hoverGrid = this.pixelToGrid(x, y);
  }

  onPointerUp(): void { /* handled in onPointerDown */ }

  // ── Controls ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.components = [];
    this.componentType = 'resistor';
    this.componentValue = 100;
    this.showCurrentFlow = true;
    this.showNodeVoltages = true;
    this.placingStart = null;
    this.totalCurrent = 0;
    this.isAC = false;
    this.nodeVoltages.clear();
    this.time = 0;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown', key: 'componentType', label: 'Component Type',
        options: [
          { value: 'wire',      label: 'Wire' },
          { value: 'resistor',  label: 'Resistor' },
          { value: 'battery',   label: 'Battery (DC)' },
          { value: 'ac-source', label: 'AC Source' },
          { value: 'led',       label: 'LED' },
          { value: 'switch',    label: 'Switch' },
        ],
        defaultValue: 'resistor',
      },
      { type: 'slider', key: 'componentValue', label: 'Value', min: 1, max: 1000, step: 1, defaultValue: 100, unit: '\u03A9/V' },
      { type: 'toggle', key: 'showCurrentFlow',  label: 'Current Flow',   defaultValue: true },
      { type: 'toggle', key: 'showNodeVoltages', label: 'Node Voltages',  defaultValue: true },
      { type: 'button', key: 'clearCircuit', label: 'Clear Circuit' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      componentType:    this.componentType,
      componentValue:   this.componentValue,
      showCurrentFlow:  this.showCurrentFlow,
      showNodeVoltages: this.showNodeVoltages,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'componentType':    this.componentType  = value as ComponentType; break;
      case 'componentValue':   this.componentValue = value as number; break;
      case 'showCurrentFlow':  this.showCurrentFlow  = value as boolean; break;
      case 'showNodeVoltages': this.showNodeVoltages = value as boolean; break;
      case 'clearCircuit':
        this.components = [];
        this.totalCurrent = 0;
        this.isAC = false;
        this.nodeVoltages.clear();
        this.placingStart = null;
        break;
    }
  }
}

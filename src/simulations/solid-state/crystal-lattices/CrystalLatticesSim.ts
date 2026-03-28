import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawGrid, drawText } from '@/engine/render/drawUtils.ts';

interface Atom3D {
  x: number;
  y: number;
  z: number;
  species: number; // 0 = primary, 1 = secondary, 2 = tertiary
}

// Colors and size multipliers per species
const SPECIES_COLORS: Array<{ h: number; s: number; l: number; sizeScale: number; label: string }> = [
  { h: 210, s: 80, l: 65, sizeScale: 1.0, label: 'A' },  // blue (cation / primary)
  { h: 15,  s: 85, l: 60, sizeScale: 0.7, label: 'B' },   // orange-red (anion / secondary)
  { h: 130, s: 70, l: 55, sizeScale: 0.65, label: 'O' },  // green (oxygen / tertiary)
];

interface Bond {
  a: number;
  b: number;
}

type LatticeType = 'SC' | 'BCC' | 'FCC' | 'Diamond' | 'HCP' | 'NaCl' | 'CsCl' | 'Fluorite' | 'Perovskite' | 'Graphite';

const LATTICE_INFO: Record<LatticeType, { coordination: number; atomsPerCell: number; packing: number; name: string }> = {
  SC:         { coordination: 6,  atomsPerCell: 1,  packing: 0.5236, name: 'Simple Cubic' },
  BCC:        { coordination: 8,  atomsPerCell: 2,  packing: 0.6802, name: 'Body-Centered Cubic' },
  FCC:        { coordination: 12, atomsPerCell: 4,  packing: 0.7405, name: 'Face-Centered Cubic' },
  Diamond:    { coordination: 4,  atomsPerCell: 8,  packing: 0.3401, name: 'Diamond Cubic' },
  HCP:        { coordination: 12, atomsPerCell: 6,  packing: 0.7405, name: 'Hexagonal Close-Packed' },
  NaCl:       { coordination: 6,  atomsPerCell: 8,  packing: 0.6700, name: 'Rock Salt (NaCl)' },
  CsCl:       { coordination: 8,  atomsPerCell: 2,  packing: 0.7290, name: 'Cesium Chloride' },
  Fluorite:   { coordination: 4,  atomsPerCell: 12, packing: 0.6340, name: 'Fluorite (CaF₂)' },
  Perovskite: { coordination: 6,  atomsPerCell: 5,  packing: 0.5200, name: 'Perovskite (ABO₃)' },
  Graphite:   { coordination: 3,  atomsPerCell: 4,  packing: 0.1700, name: 'Graphite (Layered)' },
};

export default class CrystalLatticesSim extends SimulationEngine {
  private latticeType: LatticeType = 'SC';
  private atomRadius = 12;
  private showBonds = true;
  private rotationSpeed = 0.5;

  private angleX = 0.4;
  private angleY = 0;

  private atoms: Atom3D[] = [];
  private bonds: Bond[] = [];

  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  setup(): void {
    this.buildLattice();
  }

  private buildLattice(): void {
    this.atoms = [];
    this.bonds = [];

    const n = 2; // number of unit cells per axis
    const positions: Atom3D[] = [];

    for (let ix = 0; ix <= n; ix++) {
      for (let iy = 0; iy <= n; iy++) {
        for (let iz = 0; iz <= n; iz++) {
          // Corner atoms — skip for NaCl (handled separately with full half-integer grid)
          if (this.latticeType !== 'NaCl') {
            positions.push({ x: ix, y: iy, z: iz, species: 0 });
          }

          if (this.latticeType === 'BCC' && ix < n && iy < n && iz < n) {
            positions.push({ x: ix + 0.5, y: iy + 0.5, z: iz + 0.5, species: 0 });
          }

          if (this.latticeType === 'FCC' && ix < n && iy < n && iz < n) {
            positions.push({ x: ix + 0.5, y: iy + 0.5, z: iz, species: 0 });
            positions.push({ x: ix + 0.5, y: iy, z: iz + 0.5, species: 0 });
            positions.push({ x: ix, y: iy + 0.5, z: iz + 0.5, species: 0 });
          }

          if (this.latticeType === 'Diamond' && ix < n && iy < n && iz < n) {
            positions.push({ x: ix + 0.5, y: iy + 0.5, z: iz, species: 0 });
            positions.push({ x: ix + 0.5, y: iy, z: iz + 0.5, species: 0 });
            positions.push({ x: ix, y: iy + 0.5, z: iz + 0.5, species: 0 });
            positions.push({ x: ix + 0.25, y: iy + 0.25, z: iz + 0.25, species: 0 });
            positions.push({ x: ix + 0.75, y: iy + 0.75, z: iz + 0.25, species: 0 });
            positions.push({ x: ix + 0.75, y: iy + 0.25, z: iz + 0.75, species: 0 });
            positions.push({ x: ix + 0.25, y: iy + 0.75, z: iz + 0.75, species: 0 });
          }

          // NaCl: generate all 8 atoms per unit cell on half-integer grid
          // species = (2x + 2y + 2z) % 2 — guarantees exact 1:1 ratio
          if (this.latticeType === 'NaCl' && ix < n && iy < n && iz < n) {
            for (let dx = 0; dx <= 1; dx++) {
              for (let dy = 0; dy <= 1; dy++) {
                for (let dz = 0; dz <= 1; dz++) {
                  const px = ix + dx * 0.5;
                  const py = iy + dy * 0.5;
                  const pz = iz + dz * 0.5;
                  positions.push({ x: px, y: py, z: pz, species: (dx + dy + dz) % 2 });
                }
              }
            }
          }

          // CsCl: Cs at corners (species 0, big), Cl at body center (species 1, small)
          if (this.latticeType === 'CsCl' && ix < n && iy < n && iz < n) {
            positions.push({ x: ix + 0.5, y: iy + 0.5, z: iz + 0.5, species: 1 });
          }

          // Fluorite: Ca at FCC sites (species 0, big), F at tetrahedral sites (species 1, small)
          if (this.latticeType === 'Fluorite' && ix < n && iy < n && iz < n) {
            positions.push({ x: ix + 0.5, y: iy + 0.5, z: iz, species: 0 });
            positions.push({ x: ix + 0.5, y: iy, z: iz + 0.5, species: 0 });
            positions.push({ x: ix, y: iy + 0.5, z: iz + 0.5, species: 0 });
            positions.push({ x: ix + 0.25, y: iy + 0.25, z: iz + 0.25, species: 1 });
            positions.push({ x: ix + 0.75, y: iy + 0.75, z: iz + 0.25, species: 1 });
            positions.push({ x: ix + 0.75, y: iy + 0.25, z: iz + 0.75, species: 1 });
            positions.push({ x: ix + 0.25, y: iy + 0.75, z: iz + 0.75, species: 1 });
            positions.push({ x: ix + 0.25, y: iy + 0.75, z: iz + 0.25, species: 1 });
            positions.push({ x: ix + 0.75, y: iy + 0.25, z: iz + 0.25, species: 1 });
            positions.push({ x: ix + 0.25, y: iy + 0.25, z: iz + 0.75, species: 1 });
            positions.push({ x: ix + 0.75, y: iy + 0.75, z: iz + 0.75, species: 1 });
          }

          // Perovskite: A at corners (0, big), B at body center (1, medium), O at face centers (2, small green)
          if (this.latticeType === 'Perovskite' && ix < n && iy < n && iz < n) {
            positions.push({ x: ix + 0.5, y: iy + 0.5, z: iz + 0.5, species: 1 });
            positions.push({ x: ix + 0.5, y: iy + 0.5, z: iz, species: 2 });
            positions.push({ x: ix + 0.5, y: iy, z: iz + 0.5, species: 2 });
            positions.push({ x: ix, y: iy + 0.5, z: iz + 0.5, species: 2 });
          }

          // HCP
          if (this.latticeType === 'HCP' && ix < n && iy < n && iz < n) {
            positions.push({ x: ix + 0.5, y: iy + 1/3, z: iz + 0.5, species: 0 });
            positions.push({ x: ix, y: iy + 2/3, z: iz + 0.5, species: 0 });
          }

          // Graphite: skip here — built separately below with hex coordinates

        }
      }
    }

    // Graphite: build hexagonal honeycomb with AB stacking (all carbon = species 0)
    if (this.latticeType === 'Graphite') {
      // Remove any corner atoms added by the main loop
      positions.length = 0;
      const sqrt3 = Math.sqrt(3);
      // Hex lattice vectors: a1 = (1, 0), a2 = (0.5, √3/2)
      const a1x = 1, a1y = 0;
      const a2x = 0.5, a2y = sqrt3 / 2;
      // Sublattice offset: (a1 + a2) / 3
      const offX = (a1x + a2x) / 3;
      const offY = (a1y + a2y) / 3;
      const layerZ = 1.2; // large interlayer spacing (graphite c/a ≈ 2.7)

      for (let i = -1; i <= n; i++) {
        for (let j = -1; j <= n; j++) {
          const bx = i * a1x + j * a2x;
          const by = i * a1y + j * a2y;

          // Layer A (z = 0): two sublattice atoms per cell
          positions.push({ x: bx, y: by, z: 0, species: 0 });
          positions.push({ x: bx + offX, y: by + offY, z: 0, species: 0 });

          // Layer B (z = layerZ): shifted by (a1 + a2)/3 relative to A
          // In AB stacking, B-layer atoms sit above centers of A-layer hexagons
          positions.push({ x: bx + offX, y: by + offY, z: layerZ, species: 0 });
          positions.push({ x: bx + 2 * offX, y: by + 2 * offY, z: layerZ, species: 0 });
        }
      }
    }

    // Center the lattice
    const cx = n / 2;
    const cy = n / 2;
    const cz = n / 2;
    this.atoms = positions.map(p => ({ x: p.x - cx, y: p.y - cy, z: p.z - cz, species: p.species }));

    // Build bonds between nearest neighbors
    const bondDist = this.getBondDistance();
    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const dx = this.atoms[i].x - this.atoms[j].x;
        const dy = this.atoms[i].y - this.atoms[j].y;
        const dz = this.atoms[i].z - this.atoms[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < bondDist + 0.01) {
          this.bonds.push({ a: i, b: j });
        }
      }
    }
  }

  private getBondDistance(): number {
    switch (this.latticeType) {
      case 'SC': return 1.0;
      case 'BCC': return Math.sqrt(3) / 2;
      case 'FCC': return Math.sqrt(2) / 2;
      case 'Diamond': return Math.sqrt(3) / 4;
      case 'HCP': return 0.75;
      case 'NaCl': return Math.sqrt(2) / 2;
      case 'CsCl': return Math.sqrt(3) / 2;
      case 'Fluorite': return Math.sqrt(3) / 4 + 0.01; // Ca-F bond ≈ 0.433
      case 'Perovskite': return 0.51; // B-O bond = 0.5 (body center to face center)
      case 'Graphite': return 1 / Math.sqrt(3) + 0.01; // C-C bond ≈ 0.577 (in-plane only)
    }
  }

  private project(atom: Atom3D): { sx: number; sy: number; depth: number } {
    // Rotate around Y axis then X axis
    const cosY = Math.cos(this.angleY);
    const sinY = Math.sin(this.angleY);
    const cosX = Math.cos(this.angleX);
    const sinX = Math.sin(this.angleX);

    // Rotate Y
    let x1 = atom.x * cosY + atom.z * sinY;
    const y1 = atom.y;
    let z1 = -atom.x * sinY + atom.z * cosY;

    // Rotate X
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    const scale = Math.min(this.width, this.height) * 0.22;
    return {
      sx: this.width / 2 + x2 * scale,
      sy: this.height / 2 + y2 * scale,
      depth: z2,
    };
  }

  update(dt: number): void {
    this.time += dt;
    if (!this.dragging) {
      this.angleY += this.rotationSpeed * dt;
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height);
    drawGrid(ctx, width, height, 50, 'rgba(255,255,255,0.05)');

    // Project all atoms
    const projected = this.atoms.map(a => this.project(a));

    // Find depth range for coloring
    let minDepth = Infinity, maxDepth = -Infinity;
    for (const p of projected) {
      if (p.depth < minDepth) minDepth = p.depth;
      if (p.depth > maxDepth) maxDepth = p.depth;
    }
    const depthRange = maxDepth - minDepth || 1;

    // Draw bonds first (back to front is not critical for lines)
    if (this.showBonds) {
      for (const bond of this.bonds) {
        const a = projected[bond.a];
        const b = projected[bond.b];
        const avgDepth = (a.depth + b.depth) / 2;
        const t = (avgDepth - minDepth) / depthRange;
        const alpha = 0.15 + t * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
        ctx.lineWidth = 1 + t;
        ctx.stroke();
      }
    }

    // Sort atoms back-to-front for correct overlap
    const indices = projected.map((_, i) => i);
    indices.sort((a, b) => projected[a].depth - projected[b].depth);

    for (const i of indices) {
      const p = projected[i];
      const atom = this.atoms[i];
      const t = (p.depth - minDepth) / depthRange; // 0 = far, 1 = near
      const sp = SPECIES_COLORS[atom.species] || SPECIES_COLORS[0];

      const r = this.atomRadius * sp.sizeScale * (0.6 + 0.4 * t);
      const brightness = 0.4 + 0.6 * t;
      const lAdj = sp.l * brightness;

      // HSL-based coloring per species
      const baseColor = `hsl(${sp.h}, ${sp.s}%, ${lAdj}%)`;
      const highlight = `hsl(${sp.h}, ${Math.max(0, sp.s - 20)}%, ${Math.min(95, lAdj + 25)}%)`;
      const shadow = `hsl(${sp.h}, ${sp.s}%, ${lAdj * 0.4}%)`;

      const grad = ctx.createRadialGradient(
        p.sx - r * 0.3, p.sy - r * 0.3, r * 0.1,
        p.sx, p.sy, r
      );
      grad.addColorStop(0, highlight);
      grad.addColorStop(0.7, baseColor);
      grad.addColorStop(1, shadow);

      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Info overlay
    const info = LATTICE_INFO[this.latticeType];
    const infoX = width - 15;
    const infoY = 20;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(infoX - 230, infoY - 5, 235, 80);
    drawText(ctx, `${info.name}`, infoX, infoY + 10, '#e2e8f0', '12px monospace', 'right');
    drawText(ctx, `Coordination Number: ${info.coordination}`, infoX, infoY + 28, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Atoms / Unit Cell: ${info.atomsPerCell}`, infoX, infoY + 46, '#94a3b8', '11px monospace', 'right');
    drawText(ctx, `Packing Fraction: ${info.packing.toFixed(4)}`, infoX, infoY + 64, '#94a3b8', '11px monospace', 'right');

    // Title
    drawText(ctx, 'Crystal Lattice Viewer', 15, 25, '#e2e8f0', 'bold 14px system-ui', 'left');
    drawText(ctx, 'Drag to rotate', 15, 45, '#64748b', '11px system-ui', 'left');
  }

  reset(): void {
    this.angleX = 0.4;
    this.angleY = 0;
    this.time = 0;
    this.buildLattice();
  }

  onPointerDown(x: number, y: number): void {
    this.dragging = true;
    this.lastPointerX = x;
    this.lastPointerY = y;
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    const dx = x - this.lastPointerX;
    const dy = y - this.lastPointerY;
    this.angleY += dx * 0.01;
    this.angleX += dy * 0.01;
    this.angleX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.angleX));
    this.lastPointerX = x;
    this.lastPointerY = y;
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown', key: 'latticeType', label: 'Lattice Type',
        options: [
          { value: 'SC', label: 'Simple Cubic (SC)' },
          { value: 'BCC', label: 'Body-Centered Cubic (BCC)' },
          { value: 'FCC', label: 'Face-Centered Cubic (FCC)' },
          { value: 'HCP', label: 'Hexagonal Close-Packed (HCP)' },
          { value: 'Diamond', label: 'Diamond Cubic' },
          { value: 'NaCl', label: 'Rock Salt (NaCl)' },
          { value: 'CsCl', label: 'Cesium Chloride (CsCl)' },
          { value: 'Fluorite', label: 'Fluorite (CaF₂)' },
          { value: 'Perovskite', label: 'Perovskite (ABO₃)' },
          { value: 'Graphite', label: 'Graphite (Layered)' },
        ],
        defaultValue: 'SC',
      },
      { type: 'slider', key: 'atomRadius', label: 'Atom Radius', min: 5, max: 20, step: 1, defaultValue: 12, unit: 'px' },
      { type: 'toggle', key: 'showBonds', label: 'Show Bonds', defaultValue: true },
      { type: 'slider', key: 'rotationSpeed', label: 'Rotation Speed', min: 0, max: 2, step: 0.1, defaultValue: 0.5, unit: 'rad/s' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      latticeType: this.latticeType,
      atomRadius: this.atomRadius,
      showBonds: this.showBonds,
      rotationSpeed: this.rotationSpeed,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'latticeType':
        this.latticeType = value as LatticeType;
        this.buildLattice();
        break;
      case 'atomRadius': this.atomRadius = value as number; break;
      case 'showBonds': this.showBonds = value as boolean; break;
      case 'rotationSpeed': this.rotationSpeed = value as number; break;
    }
  }
}

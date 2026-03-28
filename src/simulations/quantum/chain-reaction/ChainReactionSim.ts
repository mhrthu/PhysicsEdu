import { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { clearCanvas, drawText } from '@/engine/render/drawUtils.ts';

interface Nucleus {
  x: number;
  y: number;
  fissioned: boolean;
  glowTimer: number;
}

interface Neutron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  absorbed: boolean;
}

interface Explosion {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

export default class ChainReactionSim extends SimulationEngine {
  private enrichment = 0.85;      // probability a neutron causes fission
  private neutronsPerFission = 2.5;
  private neutronSpeed = 80;
  private showTrails = true;
  private material: 'uranium' | 'plutonium' | 'carbon' = 'uranium';

  private nuclei: Nucleus[] = [];
  private neutrons: Neutron[] = [];
  private explosions: Explosion[] = [];
  private trails: { x: number; y: number; age: number }[] = [];

  private fissionCount = 0;
  private neutronCount = 0;
  private energyReleased = 0;
  private reactionState: 'idle' | 'running' | 'critical' | 'supercritical' | 'subcritical' = 'idle';
  private subcriticalFrames = 0;

  // Chart history
  private fissionHistory: number[] = [];
  private maxHistory = 120;

  // Grid layout
  private cellSize = 0;
  private cols = 0;
  private rows = 0;
  private gridOffX = 0;
  private gridOffY = 0;

  setup(): void {
    this.buildGrid();
    this.reset();
  }

  private buildGrid(): void {
    const margin = 140;
    const area = Math.min(this.width - margin, this.height - 80);
    this.cols = 14;
    this.rows = 10;
    this.cellSize = Math.floor(area / Math.max(this.cols, this.rows));
    this.gridOffX = Math.floor((this.width - this.cols * this.cellSize) / 2) - 40;
    this.gridOffY = Math.floor((this.height - this.rows * this.cellSize) / 2) + 10;
  }

  reset(): void {
    this.nuclei = [];
    this.neutrons = [];
    this.explosions = [];
    this.trails = [];
    this.fissionCount = 0;
    this.neutronCount = 0;
    this.energyReleased = 0;
    this.reactionState = 'idle';
    this.subcriticalFrames = 0;
    this.fissionHistory = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const jitterX = (Math.random() - 0.5) * this.cellSize * 0.4;
        const jitterY = (Math.random() - 0.5) * this.cellSize * 0.4;
        this.nuclei.push({
          x: this.gridOffX + (col + 0.5) * this.cellSize + jitterX,
          y: this.gridOffY + (row + 0.5) * this.cellSize + jitterY,
          fissioned: false,
          glowTimer: 0,
        });
      }
    }

    // Start with one free neutron aimed at center
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.neutrons.push({
      x: this.gridOffX - 40,
      y: cy + (Math.random() - 0.5) * 20,
      vx: this.neutronSpeed,
      vy: (Math.random() - 0.5) * 10,
      age: 0,
      absorbed: false,
    });
    this.neutronCount = 1;
    this.reactionState = 'running';
    this.time = 0;
  }

  private fireSingleNeutron(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.neutrons.push({
      x: this.gridOffX - 40,
      y: cy + (Math.random() - 0.5) * this.cellSize * this.rows * 0.8,
      vx: this.neutronSpeed * (0.8 + Math.random() * 0.4),
      vy: (Math.random() - 0.5) * 30,
      age: 0,
      absorbed: false,
    });
  }

  update(dt: number): void {
    if (this.reactionState === 'idle') return;
    this.time += dt;

    const fissionsThisFrame: { x: number; y: number }[] = [];

    // Move neutrons
    const toRemove = new Set<number>();
    for (let ni = 0; ni < this.neutrons.length; ni++) {
      const n = this.neutrons[ni];
      if (n.absorbed) { toRemove.add(ni); continue; }

      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.age += dt;

      if (this.showTrails) {
        this.trails.push({ x: n.x, y: n.y, age: 0 });
      }

      // Out of bounds
      if (n.x < -60 || n.x > this.width + 60 || n.y < -60 || n.y > this.height + 60 || n.age > 8) {
        toRemove.add(ni);
        continue;
      }

      // Check collision with nuclei
      const captureR = this.cellSize * 0.32;
      for (const nucleus of this.nuclei) {
        if (nucleus.fissioned) continue;
        const dx = n.x - nucleus.x, dy = n.y - nucleus.y;
        if (dx * dx + dy * dy < captureR * captureR) {
          n.absorbed = true;
          toRemove.add(ni);

          if (Math.random() < this.enrichment) {
            // Fission!
            nucleus.fissioned = true;
            nucleus.glowTimer = 1;
            fissionsThisFrame.push({ x: nucleus.x, y: nucleus.y });
            this.fissionCount++;
            this.energyReleased += this.materialEnergy();

            this.explosions.push({ x: nucleus.x, y: nucleus.y, r: 0, maxR: this.cellSize * 1.2, alpha: 1 });

            // Emit secondary neutrons
            const count = Math.floor(this.neutronsPerFission) + (Math.random() < (this.neutronsPerFission % 1) ? 1 : 0);
            for (let k = 0; k < count; k++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = this.neutronSpeed * (0.7 + Math.random() * 0.6);
              this.neutrons.push({
                x: nucleus.x + Math.cos(angle) * 4,
                y: nucleus.y + Math.sin(angle) * 4,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                age: 0,
                absorbed: false,
              });
            }
          }
          break;
        }
      }
    }

    // Remove absorbed/out-of-bounds neutrons (reverse order)
    const surviving = this.neutrons.filter((_, i) => !toRemove.has(i));
    this.neutrons = surviving;

    // Record fission history
    this.fissionHistory.push(fissionsThisFrame.length);
    if (this.fissionHistory.length > this.maxHistory) this.fissionHistory.shift();

    // Cap neutrons to prevent meltdown freeze
    if (this.neutrons.length > 400) {
      this.neutrons = this.neutrons.slice(this.neutrons.length - 400);
    }

    // Update explosions
    for (const ex of this.explosions) {
      ex.r += (ex.maxR - ex.r) * dt * 8;
      ex.alpha -= dt * 2;
    }
    this.explosions = this.explosions.filter(e => e.alpha > 0);

    // Update trails
    for (const t of this.trails) t.age += dt;
    this.trails = this.trails.filter(t => t.age < 0.3);

    // Update nucleus glow
    for (const n of this.nuclei) {
      if (n.glowTimer > 0) n.glowTimer -= dt * 3;
    }

    // Determine reaction state
    const activeFissions = this.fissionHistory.slice(-10).reduce((a, b) => a + b, 0);
    const remaining = this.nuclei.filter(n => !n.fissioned).length;
    if (remaining === 0 || this.fissionCount >= this.cols * this.rows) {
      this.reactionState = 'supercritical';
    } else if (this.neutrons.length === 0 && fissionsThisFrame.length === 0) {
      this.subcriticalFrames++;
      if (this.subcriticalFrames > 60) this.reactionState = 'subcritical';
    } else {
      this.subcriticalFrames = 0;
      const k = activeFissions > 0 ? this.neutrons.length / Math.max(1, activeFissions) : 1;
      if (k > 2) this.reactionState = 'supercritical';
      else if (k > 0.9) this.reactionState = 'critical';
      else this.reactionState = 'running';
    }
  }

  render(): void {
    const { ctx, width, height } = this;
    clearCanvas(ctx, width, height, '#09090b');

    // Background grid glow
    const remaining = this.nuclei.filter(n => !n.fissioned).length;
    const reactivity = Math.min(1, this.neutrons.length / 20);
    if (reactivity > 0) {
      const grd = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.6);
      grd.addColorStop(0, `rgba(255,140,0,${reactivity * 0.08})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw trails
    if (this.showTrails) {
      for (const t of this.trails) {
        const alpha = (1 - t.age / 0.3) * 0.4;
        ctx.fillStyle = `rgba(100,200,255,${alpha})`;
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
      }
    }

    // Draw explosions
    for (const ex of this.explosions) {
      const grd = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r);
      grd.addColorStop(0, `rgba(255,240,100,${ex.alpha * 0.9})`);
      grd.addColorStop(0.4, `rgba(255,120,0,${ex.alpha * 0.5})`);
      grd.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw nuclei
    const nr = this.cellSize * 0.22;
    for (const nucleus of this.nuclei) {
      if (nucleus.fissioned) {
        // Spent fuel: dark dot with faint glow
        if (nucleus.glowTimer > 0) {
          const g = ctx.createRadialGradient(nucleus.x, nucleus.y, 0, nucleus.x, nucleus.y, nr * 3);
          g.addColorStop(0, `rgba(255,200,50,${nucleus.glowTimer * 0.3})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(nucleus.x, nucleus.y, nr * 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(nucleus.x, nucleus.y, nr * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,60,0,0.6)'; ctx.fill();
      } else {
        // Active nucleus
        const g = ctx.createRadialGradient(nucleus.x - nr * 0.3, nucleus.y - nr * 0.3, 0, nucleus.x, nucleus.y, nr);
        g.addColorStop(0, this.materialColor(0.9));
        g.addColorStop(1, this.materialColor(0.5));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(nucleus.x, nucleus.y, nr, 0, Math.PI * 2); ctx.fill();

        // Subtle halo
        ctx.strokeStyle = this.materialColor(0.2);
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(nucleus.x, nucleus.y, nr * 1.5, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Draw neutrons
    for (const n of this.neutrons) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 5);
      g.addColorStop(0, 'rgba(160,220,255,1)');
      g.addColorStop(1, 'rgba(60,140,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Right panel: stats
    const px = this.gridOffX + this.cols * this.cellSize + 20;
    const py = this.gridOffY + 10;
    const panelW = width - px - 10;

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.roundRect?.(px - 4, py - 4, panelW + 8, 200, 8); ctx.fill();

    const stateColors: Record<string, string> = {
      idle: '#64748b', running: '#22c55e', critical: '#f59e0b',
      supercritical: '#ef4444', subcritical: '#3b82f6',
    };
    const stateLabels: Record<string, string> = {
      idle: 'Idle', running: 'Chain Reaction', critical: 'Critical',
      supercritical: 'Supercritical!', subcritical: 'Subcritical',
    };
    drawText(ctx, stateLabels[this.reactionState], px + panelW / 2, py + 14, stateColors[this.reactionState], 'bold 12px system-ui', 'center');

    const lines = [
      ['Fissions', `${this.fissionCount}`],
      ['Neutrons', `${this.neutrons.length}`],
      ['Remaining', `${remaining}`],
      ['Energy', `${(this.energyReleased * 1e-6).toFixed(1)} MJ`],
    ];
    lines.forEach(([label, value], i) => {
      const y = py + 38 + i * 28;
      drawText(ctx, label, px + 6, y, 'rgba(255,255,255,0.4)', '10px system-ui', 'left');
      drawText(ctx, value, px + panelW - 4, y, 'rgba(255,255,255,0.9)', 'bold 11px monospace', 'right');
    });

    // Fission rate mini-chart
    const chartY = py + 160;
    const chartH = 50;
    if (this.fissionHistory.length > 1) {
      const maxFiss = Math.max(1, ...this.fissionHistory);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < this.fissionHistory.length; i++) {
        const fx = px + (i / this.maxHistory) * panelW;
        const fy = chartY + chartH - (this.fissionHistory[i] / maxFiss) * chartH;
        if (i === 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
      drawText(ctx, 'Fission rate', px + 4, chartY - 6, 'rgba(255,255,255,0.3)', '9px system-ui', 'left');
    }

    // Instruction
    drawText(ctx, 'Click canvas to fire neutron', width / 2, height - 14, 'rgba(255,255,255,0.25)', '11px system-ui', 'center');
  }

  private materialColor(alpha: number): string {
    switch (this.material) {
      case 'uranium':   return `rgba(100,220,100,${alpha})`;
      case 'plutonium': return `rgba(120,180,255,${alpha})`;
      case 'carbon':    return `rgba(200,200,200,${alpha})`;
    }
  }

  private materialEnergy(): number {
    switch (this.material) {
      case 'uranium':   return 200e6 * 1.602e-19;
      case 'plutonium': return 210e6 * 1.602e-19;
      case 'carbon':    return 0;
    }
  }

  onPointerDown(x: number, y: number): void {
    // Fire a neutron from the left toward click position
    const dx = x - (this.gridOffX - 40);
    const dy = y - (this.gridOffY + this.rows * this.cellSize / 2);
    const len = Math.sqrt(dx * dx + dy * dy);
    this.neutrons.push({
      x: this.gridOffX - 40,
      y: y,
      vx: (dx / len) * this.neutronSpeed,
      vy: (dy / len) * this.neutronSpeed,
      age: 0,
      absorbed: false,
    });
    if (this.reactionState === 'subcritical' || this.reactionState === 'idle') {
      this.reactionState = 'running';
      this.subcriticalFrames = 0;
    }
  }

  getControlDescriptors(): ControlDescriptor[] {
    return [
      {
        type: 'dropdown', key: 'material', label: 'Material',
        options: [
          { value: 'uranium', label: '²³⁵U Uranium-235' },
          { value: 'plutonium', label: '²³⁹Pu Plutonium-239' },
          { value: 'carbon', label: 'Carbon (moderator)' },
        ],
        defaultValue: 'uranium',
      },
      { type: 'slider', key: 'enrichment', label: 'Fission Probability', min: 0.1, max: 1.0, step: 0.05, defaultValue: 0.85 },
      { type: 'slider', key: 'neutronsPerFission', label: 'Neutrons / Fission', min: 1, max: 4, step: 0.1, defaultValue: 2.5 },
      { type: 'slider', key: 'neutronSpeed', label: 'Neutron Speed', min: 30, max: 200, step: 5, defaultValue: 80 },
      { type: 'toggle', key: 'showTrails', label: 'Neutron Trails', defaultValue: true },
      { type: 'button', key: 'reset', label: '🔄 Reset Assembly' },
      { type: 'button', key: 'fire', label: '⚡ Fire Neutron' },
    ];
  }

  getControlValues(): Record<string, number | boolean | string> {
    return {
      material: this.material,
      enrichment: this.enrichment,
      neutronsPerFission: this.neutronsPerFission,
      neutronSpeed: this.neutronSpeed,
      showTrails: this.showTrails,
    };
  }

  setControlValue(key: string, value: number | boolean | string): void {
    switch (key) {
      case 'material': this.material = value as 'uranium' | 'plutonium' | 'carbon'; this.reset(); break;
      case 'enrichment': this.enrichment = value as number; break;
      case 'neutronsPerFission': this.neutronsPerFission = value as number; break;
      case 'neutronSpeed': this.neutronSpeed = value as number; break;
      case 'showTrails': this.showTrails = value as boolean; break;
      case 'reset': this.reset(); break;
      case 'fire': this.fireSingleNeutron(); break;
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    super.resize(width, height, pixelRatio);
    this.buildGrid();
    this.reset();
  }
}

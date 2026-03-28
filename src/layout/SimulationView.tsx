import { useRef, useEffect } from 'react';
import { useSimulation } from '@/hooks/useSimulation.ts';
import { ControlPanel } from '@/controls/ControlPanel.tsx';
import { getSimulation } from '@/catalog/registry.ts';
import { LEVEL_COLORS, DOMAIN_COLORS, DOMAIN_ICONS } from '@/catalog/types.ts';

const LEVEL_SHORT: Record<string, string> = {
  'Elementary': 'Intro',
  'Middle School': 'Inter',
  'High School': 'Standard',
  'Undergraduate': 'Advanced',
  'Graduate': 'Theory',
};

interface Props { simId: string; }

export function SimulationView({ simId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useSimulation(simId, canvasRef);
  const meta = getSimulation(simId);
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); }
      sim.handleResize(w, h, dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [sim.handleResize]);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        {meta && (
          <div
            className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-sm">{DOMAIN_ICONS[meta.domain]}</span>
                <span className="text-[11px] font-medium" style={{ color: DOMAIN_COLORS[meta.domain] }}>
                  {meta.domain}
                </span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
              <h2 className="text-[13px] font-semibold truncate" style={{ color: '#f1f5f9' }}>
                {meta.title}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: LEVEL_COLORS[meta.level] + '15',
                  color: LEVEL_COLORS[meta.level],
                }}
              >
                {LEVEL_SHORT[meta.level]}
              </span>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative" style={{ background: '#09090b' }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ cursor: 'crosshair' }}
            onPointerDown={sim.handlePointerDown}
            onPointerMove={sim.handlePointerMove}
            onPointerUp={sim.handlePointerUp}
          />
          {!sim.ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(99,102,241,0.4)', borderTopColor: 'transparent' }}
              />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Loading…</p>
            </div>
          )}
        </div>
      </div>

      {/* Control panel — always on the side */}
      <ControlPanel
        descriptors={sim.controlDescriptors}
        values={sim.controlValues}
        onChange={sim.setControl}
        isRunning={sim.isRunning}
        speed={sim.speed}
        onPlay={sim.play}
        onPause={sim.pause}
        onReset={sim.reset}
        onStep={sim.stepForward}
        onSpeedChange={sim.setSpeed}
      />
    </div>
  );
}

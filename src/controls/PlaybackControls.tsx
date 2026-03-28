interface Props {
  isRunning: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
}

export function PlaybackControls({ isRunning, speed, onPlay, onPause, onReset, onStep, onSpeedChange }: Props) {
  return (
    <div className="space-y-3">
      {/* Play/Pause + Step + Reset */}
      <div className="flex items-center gap-2">
        <button
          onClick={isRunning ? onPause : onPlay}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: isRunning ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.85)',
            border: `1px solid ${isRunning ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
            color: isRunning ? '#a5b4fc' : 'white',
          }}
        >
          {isRunning ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={onStep}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          title="Step"
        >
          ⏭
        </button>
        <button
          onClick={onReset}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          title="Reset"
        >
          ↺
        </button>
      </div>

      {/* Speed */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Speed</span>
          <span className="text-[10px] font-semibold font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{speed.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={speed}
          onChange={e => onSpeedChange(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}

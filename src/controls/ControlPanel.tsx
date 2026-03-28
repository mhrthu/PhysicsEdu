import type { ControlDescriptor } from './types.ts';
import { SliderControl } from './SliderControl.tsx';
import { ToggleControl } from './ToggleControl.tsx';
import { DropdownControl } from './DropdownControl.tsx';
import { PlaybackControls } from './PlaybackControls.tsx';

interface Props {
  descriptors: ControlDescriptor[];
  values: Record<string, number | boolean | string>;
  onChange: (key: string, value: number | boolean | string) => void;
  isRunning: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
}

export function ControlPanel({
  descriptors, values, onChange,
  isRunning, speed, onPlay, onPause, onReset, onStep, onSpeedChange,
}: Props) {
  return (
    <div
      className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        width: 240,
        background: 'rgba(12,12,14,0.95)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="px-4 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Controls</p>
        <PlaybackControls
          isRunning={isRunning}
          speed={speed}
          onPlay={onPlay}
          onPause={onPause}
          onReset={onReset}
          onStep={onStep}
          onSpeedChange={onSpeedChange}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {descriptors.map(desc => {
          switch (desc.type) {
            case 'slider':
              return (
                <SliderControl
                  key={desc.key}
                  label={desc.label}
                  value={(values[desc.key] as number) ?? desc.defaultValue}
                  min={desc.min}
                  max={desc.max}
                  step={desc.step}
                  unit={desc.unit}
                  onChange={v => onChange(desc.key, v)}
                />
              );
            case 'toggle':
              return (
                <ToggleControl
                  key={desc.key}
                  label={desc.label}
                  value={(values[desc.key] as boolean) ?? desc.defaultValue}
                  onChange={v => onChange(desc.key, v)}
                />
              );
            case 'dropdown':
              return (
                <DropdownControl
                  key={desc.key}
                  label={desc.label}
                  value={(values[desc.key] as string) ?? desc.defaultValue}
                  options={desc.options}
                  onChange={v => onChange(desc.key, v)}
                />
              );
            case 'button':
              return (
                <button
                  key={desc.key}
                  onClick={() => onChange(desc.key, true)}
                  className="w-full text-xs font-medium py-2.5 rounded-xl transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  }}
                >
                  {desc.label}
                </button>
              );
          }
        })}
      </div>
    </div>
  );
}

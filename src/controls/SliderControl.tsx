interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function SliderControl({ label, value, min, max, step, unit, onChange }: Props) {
  const decimals = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
  return (
    <div className="py-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span className="text-xs font-semibold font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {value.toFixed(decimals)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

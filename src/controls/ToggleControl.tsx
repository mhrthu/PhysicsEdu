interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleControl({ label, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 transition-all duration-200"
        style={{ width: 36, height: 20 }}
        aria-checked={value}
        role="switch"
      >
        <div
          className="absolute inset-0 rounded-full transition-all duration-200"
          style={{ background: value ? '#6366f1' : 'rgba(255,255,255,0.12)' }}
        />
        <div
          className="absolute top-0.5 transition-all duration-200 rounded-full shadow-sm"
          style={{
            width: 16,
            height: 16,
            background: 'white',
            left: value ? 18 : 2,
          }}
        />
      </button>
    </div>
  );
}

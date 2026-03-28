interface Props {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function DropdownControl({ label, value, options, onChange }: Props) {
  return (
    <div className="py-2">
      <label className="text-xs font-medium block mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-xs py-2.5 px-3 rounded-xl outline-none appearance-none cursor-pointer transition-all"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: '#1c1c1e' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

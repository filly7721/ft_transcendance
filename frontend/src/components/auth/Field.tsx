type Props = {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
};

export default function Field({ label, type, value, onChange }: Props) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-mono uppercase tracking-widest text-arcade-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full border border-arcade-border bg-arcade-bg px-3 py-2 text-sm font-mono text-foreground outline-none transition-colors focus:border-neon-cyan"
      />
    </label>
  );
}

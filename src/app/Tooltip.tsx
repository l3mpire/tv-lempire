export default function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className="tooltip-label">{label}</span>
    </span>
  );
}

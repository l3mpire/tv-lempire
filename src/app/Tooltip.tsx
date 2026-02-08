export default function Tooltip({ label, children, position = "top" }: { label: string; children: React.ReactNode; position?: "top" | "bottom" }) {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className={`tooltip-label${position === "bottom" ? " tooltip-bottom" : ""}`}>{label}</span>
    </span>
  );
}

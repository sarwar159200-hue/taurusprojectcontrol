type Props = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
  onClick?: () => void;
};

export function KpiCard({ label, value, detail, tone = "neutral", onClick }: Props) {
  return (
    <article
      className={`kpi-card kpi-${tone}${onClick ? " kpi-interactive" : ""}`}
      onClick={onClick}
      onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {detail ? <div className="kpi-detail">{detail}</div> : null}
    </article>
  );
}

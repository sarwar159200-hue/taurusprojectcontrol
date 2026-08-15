type Props = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
};

export function KpiCard({ label, value, detail, tone = "neutral" }: Props) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {detail ? <div className="kpi-detail">{detail}</div> : null}
    </article>
  );
}

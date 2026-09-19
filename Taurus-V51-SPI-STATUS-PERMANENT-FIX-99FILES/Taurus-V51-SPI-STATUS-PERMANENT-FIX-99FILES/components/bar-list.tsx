type Props = {
  data: Record<string, number>;
  limit?: number;
  formatter?: (value: number) => string;
};

export function BarList({ data, limit = 8, formatter = String }: Props) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return (
    <div className="bar-list">
      {entries.map(([label, value], index) => (
        <div className="bar-row" key={label}>
          <div className="bar-meta">
            <span>{label}</span>
            <strong>{formatter(value)}</strong>
          </div>
          <div className="bar-track">
            <span
              className={`bar-fill bar-color-${(index % 5) + 1}`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

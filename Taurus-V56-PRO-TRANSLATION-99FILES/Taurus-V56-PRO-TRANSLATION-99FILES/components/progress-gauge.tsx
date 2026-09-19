"use client";

import { useLanguage } from "@/components/language-provider";

export function ProgressGauge({
  label,
  value,
  detail,
  tone = "green"
}: {
  label: string;
  value: number | null;
  detail: string;
  tone?: "green" | "blue";
}) {
  const { t } = useLanguage();
  const percentage = value === null ? 0 : Math.max(0, Math.min(100, value * 100));
  const color = tone === "green" ? "#16a879" : "#2f63b7";

  return (
    <article className={`progress-gauge-card gauge-${tone}`}>
      <div className="progress-gauge-copy">
        <span>{t(label)}</span>
        <strong>{value === null ? "—" : `${percentage.toFixed(2)}%`}</strong>
        <small>{t(detail)}</small>
      </div>
      <div className="progress-gauge-visual" aria-label={`${t(label)} ${percentage.toFixed(2)}%`}>
        <svg viewBox="0 0 120 120" role="img">
          <circle className="gauge-track" cx="60" cy="60" fill="none" pathLength="100" r="47" />
          <circle
            className="gauge-value"
            cx="60"
            cy="60"
            fill="none"
            pathLength="100"
            r="47"
            stroke={color}
            strokeDasharray={`${percentage} ${100 - percentage}`}
          />
          <circle className="gauge-inner" cx="60" cy="60" r="36" />
          <text className="gauge-number" textAnchor="middle" x="60" y="58">{percentage.toFixed(1)}%</text>
          <text className="gauge-caption" textAnchor="middle" x="60" y="73">{t("COMPLETE")}</text>
        </svg>
      </div>
    </article>
  );
}

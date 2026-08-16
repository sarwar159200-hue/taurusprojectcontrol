import { KpiCard } from "@/components/kpi-card";
import { ProgressExplorer } from "@/components/progress-explorer";
import { dashboardMetrics, overviewCurve } from "@/lib/demo-data";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate, metric } from "@/lib/published-data";
import { applyProgressWeights, evaluateProgress, makeProgressCurve } from "@/lib/progress-analytics";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  await requireSection("progress");
  const update = await getPublishedProjectUpdate({ progressSeries: true });
  const summary = update?.progressAnalysis?.summary;
  const progressSeries = applyProgressWeights(update?.progressAnalysis?.progressSeries ?? []);
  const weightedCurve = makeProgressCurve(
    progressSeries.filter((point) => point.frequency === "monthly" && point.discipline === "Overall" && point.subdiscipline === null),
    "monthly",
    "all"
  );
  const weightedEvaluation = evaluateProgress(weightedCurve);
  const m = {
    ...dashboardMetrics,
    actual: weightedEvaluation.actual === null ? metric(summary, "actual", dashboardMetrics.actual) : weightedEvaluation.actual * 100,
    planned: weightedEvaluation.planned === null ? metric(summary, "planned", dashboardMetrics.planned) : weightedEvaluation.planned * 100,
    spi: weightedEvaluation.spi ?? metric(summary, "spi", dashboardMetrics.spi),
    sv: weightedEvaluation.sv === null ? metric(summary, "sv", dashboardMetrics.sv) : weightedEvaluation.sv * 100
  };
  const curve = weightedCurve.length ? weightedCurve : update?.progressAnalysis?.chart?.length ? update.progressAnalysis.chart : overviewCurve;
  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">PROGRESS ANALYTICS</span><h1>Monthly and weekly performance</h1><p>Baseline, current plan, actual achievement and forecast controls.</p></div>
        <span className="status-pill status-ready">Year · month · week</span>
      </div>
      <section className="kpi-grid five">
        <KpiCard label="Actual" value={`${m.actual.toFixed(2)}%`} detail="Cumulative progress" tone="green" />
        <KpiCard label="Planned" value={`${m.planned.toFixed(2)}%`} detail="At current data date" tone="blue" />
        <KpiCard label="SPI" value={m.spi.toFixed(3)} detail="0.96–0.99: slightly behind" tone="amber" />
        <KpiCard label="SV" value={`${m.sv.toFixed(2)} pp`} detail="Actual minus planned" tone="red" />
        <KpiCard label="Trend finish" value={String(summary?.trendFinish ?? "Pending")} detail="Current productivity trend" />
      </section>
      <ProgressExplorer series={update?.progressAnalysis?.progressSeries ?? []} fallbackCurve={curve} />
      <section className="dashboard-grid lower-grid progress-notes">
        <article className="panel"><span className="eyebrow">FORECAST METHOD</span><h2>Two completion forecasts</h2><p>The production portal will display the P6 completion milestone and a rolling 4/8-week productivity forecast separately.</p></article>
        <article className="panel"><span className="eyebrow">STATUS THRESHOLDS</span><h2>Controlled schedule signal</h2><div className="thresholds"><span className="green-dot">Ahead &gt; 1.01</span><span className="blue-dot">On plan 0.99–1.01</span><span className="amber-dot">Slight delay 0.96–0.99</span><span className="red-dot">Delayed &lt; 0.96</span></div></article>
      </section>
    </>
  );
}

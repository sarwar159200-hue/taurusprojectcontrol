import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { ProgressExplorer } from "@/components/progress-explorer";
import {
  actionDistribution,
  dashboardMetrics,
  disciplineDistribution,
  overviewCurve
} from "@/lib/demo-data";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate, metric } from "@/lib/published-data";
import { applyProgressWeights, evaluateProgress, makeProgressCurve } from "@/lib/progress-analytics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSection("overview");
  const update = await getPublishedProjectUpdate({ progressSeries: true });
  const summary = update?.progressAnalysis?.summary;
  const scheduleSummary = update?.scheduleAnalysis?.summary;
  const progressSeries = applyProgressWeights(update?.progressAnalysis?.progressSeries ?? []);
  const weightedCurve = makeProgressCurve(
    progressSeries.filter((point) => point.frequency === "monthly" && point.discipline === "Overall" && point.subdiscipline === null),
    "monthly",
    "all"
  );
  const weightedEvaluation = evaluateProgress(weightedCurve);
  const weightedPoint = weightedCurve.find((point) => point.date === weightedEvaluation.date) ?? null;
  const metrics = {
    ...dashboardMetrics,
    actual: weightedEvaluation.actual === null ? metric(summary, "actual", dashboardMetrics.actual) : weightedEvaluation.actual * 100,
    planned: weightedEvaluation.planned === null ? metric(summary, "planned", dashboardMetrics.planned) : weightedEvaluation.planned * 100,
    baseline: weightedPoint?.baseline === null || weightedPoint?.baseline === undefined ? metric(summary, "baseline", dashboardMetrics.baseline) : weightedPoint.baseline * 100,
    spi: weightedEvaluation.spi ?? metric(summary, "spi", dashboardMetrics.spi),
    sv: weightedEvaluation.sv === null ? metric(summary, "sv", dashboardMetrics.sv) : weightedEvaluation.sv * 100,
    totalDocuments: metric(summary, "documents", dashboardMetrics.totalDocuments),
    approved: metric(summary, "approved", dashboardMetrics.approved),
    criticalActivities: metric(scheduleSummary, "critical", dashboardMetrics.criticalActivities),
    scheduleActivities: metric(scheduleSummary, "activities", dashboardMetrics.scheduleActivities)
  };
  const curve = weightedCurve.length ? weightedCurve : update?.progressAnalysis?.chart?.length ? update.progressAnalysis.chart : overviewCurve;
  const scheduleStatus = metrics.spi > 1.01 ? "Ahead of schedule" : metrics.spi >= 0.99 ? "On schedule" : metrics.spi >= 0.96 ? "Slightly behind plan" : "Delayed";
  const disciplines = update?.progressAnalysis?.distributions.disciplines ?? disciplineDistribution;
  const actions = update?.progressAnalysis?.distributions.actions ?? actionDistribution;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXECUTIVE CONTROL ROOM</span>
          <h1>Project performance overview</h1>
          <p>Latest controlled progress, document status, and schedule position.</p>
        </div>
        <button className="secondary-button" type="button">Export briefing</button>
      </div>

      <section className="kpi-grid six">
        <KpiCard label="Actual progress" value={`${metrics.actual.toFixed(2)}%`} detail="Earned to data date" tone="green" />
        <KpiCard label="Planned progress" value={`${metrics.planned.toFixed(2)}%`} detail="Current approved plan" tone="blue" />
        <KpiCard label="SPI" value={metrics.spi.toFixed(3)} detail="Slightly behind" tone="amber" />
        <KpiCard label="Schedule variance" value={`${metrics.sv.toFixed(2)} pp`} detail="Actual minus planned" tone="red" />
        <KpiCard label="Controlled documents" value={metrics.totalDocuments.toLocaleString()} detail={`${metrics.approved} final approved`} />
        <KpiCard label="Critical activities" value={String(metrics.criticalActivities)} detail={`of ${metrics.scheduleActivities.toLocaleString()} activities`} tone="red" />
      </section>

      <section className="dashboard-grid main-dashboard-grid">
        <ProgressExplorer series={update?.progressAnalysis?.progressSeries ?? []} fallbackCurve={curve} variant="overview" />
        <article className="panel insight-panel">
          <div className="panel-heading"><div><span className="eyebrow">CONTROL STATUS</span><h2>Management signal</h2></div></div>
          <div className="signal-card amber-signal">
            <span>SCHEDULE STATUS</span>
            <strong>{scheduleStatus}</strong>
            <p>SPI is {metrics.spi.toFixed(3)} with a variance of {metrics.sv.toFixed(2)} percentage points.</p>
          </div>
          <div className="metric-line"><span>Baseline position</span><strong>{metrics.baseline.toFixed(2)}%</strong></div>
          <div className="metric-line"><span>Current plan</span><strong>{metrics.planned.toFixed(2)}%</strong></div>
          <div className="metric-line"><span>Actual achieved</span><strong>{metrics.actual.toFixed(2)}%</strong></div>
          <div className="data-quality"><i>✓</i><div><strong>Workbook structure recognized</strong><span>7 progress sheets and 1 schedule sheet</span></div></div>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">DOCUMENT REGISTER</span><h2>Distribution by discipline</h2></div></div>
          <BarList data={disciplines} />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">RESPONSIBILITY</span><h2>Current document action</h2></div></div>
          <BarList data={actions} />
        </article>
      </section>
    </>
  );
}

import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { ScurveChart } from "@/components/scurve-chart";
import {
  actionDistribution,
  dashboardMetrics,
  disciplineDistribution,
  overviewCurve
} from "@/lib/demo-data";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate, metric } from "@/lib/published-data";
import { progressPerformance, signalLabel } from "@/lib/progress-metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSection("overview");
  const update = await getPublishedProjectUpdate();
  const summary = update?.progressAnalysis?.summary;
  const scheduleSummary = update?.scheduleAnalysis?.summary;
  const curve = update?.progressAnalysis?.chart?.length ? update.progressAnalysis.chart : overviewCurve;
  const performance = progressPerformance(curve);
  const metrics = {
    ...dashboardMetrics,
    actual: (performance.actual ?? dashboardMetrics.actual / 100) * 100,
    baseline: (performance.baseline ?? dashboardMetrics.baseline / 100) * 100,
    spi: performance.spi ?? dashboardMetrics.actual / dashboardMetrics.baseline,
    sv: (performance.sv ?? (dashboardMetrics.actual - dashboardMetrics.baseline) / 100) * 100,
    totalDocuments: metric(summary, "documents", dashboardMetrics.totalDocuments),
    approved: metric(summary, "approved", dashboardMetrics.approved),
    criticalActivities: metric(scheduleSummary, "critical", dashboardMetrics.criticalActivities),
    scheduleActivities: metric(scheduleSummary, "activities", dashboardMetrics.scheduleActivities)
  };
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

      <section className="kpi-grid executive-kpis">
        <KpiCard label="Actual progress" value={`${metrics.actual.toFixed(2)}%`} detail="Earned to data date" tone="green" />
        <KpiCard label="Baseline progress" value={`${metrics.baseline.toFixed(2)}%`} detail="Approved baseline at data date" tone="blue" />
        <KpiCard label="SPI" value={metrics.spi.toFixed(3)} detail={signalLabel(performance.signal)} tone={performance.signal === "ahead" ? "green" : performance.signal === "on-plan" ? "blue" : performance.signal === "slightly-behind" ? "amber" : "red"} />
        <KpiCard label="Schedule variance" value={`${metrics.sv.toFixed(2)} pp`} detail="Actual minus baseline" tone={metrics.sv >= 0 ? "green" : "red"} />
        <KpiCard label="Expected finish" value={performance.expectedFinish ?? "Pending"} detail="Baseline-performance forecast" tone="amber" />
        <KpiCard label="Controlled documents" value={metrics.totalDocuments.toLocaleString()} detail={`${metrics.approved} final approved`} />
        <KpiCard label="Critical activities" value={String(metrics.criticalActivities)} detail={`of ${metrics.scheduleActivities.toLocaleString()} activities`} tone="red" />
      </section>

      <section className="dashboard-grid main-dashboard-grid">
        <article className="panel wide-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">PERFORMANCE CURVE</span><h2>Overall cumulative S-curve</h2></div>
            <span className="comparison-badge">Baseline vs actual</span>
          </div>
          <ScurveChart points={curve} />
        </article>
        <article className="panel insight-panel">
          <div className="panel-heading"><div><span className="eyebrow">CONTROL STATUS</span><h2>Management signal</h2></div></div>
          <div className={`signal-card signal-${performance.signal}`}>
            <span>SCHEDULE STATUS</span>
            <strong>{signalLabel(performance.signal)}</strong>
            <p>SPI is {metrics.spi.toFixed(3)} with a baseline variance of {metrics.sv.toFixed(2)} percentage points.</p>
          </div>
          <div className="metric-line"><span>Baseline position</span><strong>{metrics.baseline.toFixed(2)}%</strong></div>
          <div className="metric-line"><span>Actual achieved</span><strong>{metrics.actual.toFixed(2)}%</strong></div>
          <div className="metric-line"><span>Expected finish</span><strong>{performance.expectedFinish ?? "Pending"}</strong></div>
          <div className="metric-line"><span>Forecast variance</span><strong>{performance.finishVarianceDays === null ? "—" : `${performance.finishVarianceDays > 0 ? "+" : ""}${performance.finishVarianceDays} days`}</strong></div>
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

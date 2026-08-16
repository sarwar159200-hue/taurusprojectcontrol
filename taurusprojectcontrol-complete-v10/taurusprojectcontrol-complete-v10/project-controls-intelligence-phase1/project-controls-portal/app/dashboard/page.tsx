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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSection("overview");
  const update = await getPublishedProjectUpdate({ progressSeries: true });
  const summary = update?.progressAnalysis?.summary;
  const scheduleSummary = update?.scheduleAnalysis?.summary;
  const metrics = { ...dashboardMetrics, actual: metric(summary, "actual", dashboardMetrics.actual), planned: metric(summary, "planned", dashboardMetrics.planned), baseline: metric(summary, "baseline", dashboardMetrics.baseline), spi: metric(summary, "spi", dashboardMetrics.spi), sv: metric(summary, "sv", dashboardMetrics.sv), totalDocuments: metric(summary, "documents", dashboardMetrics.totalDocuments), approved: metric(summary, "approved", dashboardMetrics.approved), criticalActivities: metric(scheduleSummary, "critical", dashboardMetrics.criticalActivities), scheduleActivities: metric(scheduleSummary, "activities", dashboardMetrics.scheduleActivities) };
  const curve = update?.progressAnalysis?.chart?.length ? update.progressAnalysis.chart : overviewCurve;
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
            <strong>Slightly behind plan</strong>
            <p>SPI is 0.964 with a variance of −1.31 percentage points.</p>
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

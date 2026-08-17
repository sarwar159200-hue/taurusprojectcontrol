import { BarList } from "@/components/bar-list";
import { ExecutivePerformanceOverview } from "@/components/executive-performance-overview";
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
  const curve = update?.progressAnalysis?.chart?.length ? update.progressAnalysis.chart : overviewCurve;
  const metrics = {
    ...dashboardMetrics,
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

      <ExecutivePerformanceOverview
        approvedDocuments={metrics.approved}
        criticalActivities={metrics.criticalActivities}
        fallbackCurve={curve}
        progressSeries={update?.progressAnalysis?.progressSeries ?? []}
        scheduleActivities={metrics.scheduleActivities}
        totalDocuments={metrics.totalDocuments}
      />

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

import { BarList } from "@/components/bar-list";
import { ExecutivePerformanceOverview } from "@/components/executive-performance-overview";
import { dashboardMetrics, disciplineDistribution, actionDistribution, overviewCurve } from "@/lib/demo-data";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate, metric } from "@/lib/published-data";

export const dynamic = "force-dynamic";

function normalize(value: string) { return value.trim().toLowerCase(); }
function statusSummary(statuses: Record<string, number>, total: number) {
  let approved = 0, approvedComments = 0, inReview = 0, toBeActioned = 0, onHold = 0;
  for (const [label, count] of Object.entries(statuses)) {
    const key = normalize(label);
    if (key.startsWith("a-approved")) approved += count;
    else if (key.startsWith("b-approved")) approvedComments += count;
    else if (key.includes("awaiting review")) inReview += count;
    else if (key.startsWith("c-revise")) toBeActioned += count;
    else if (key.includes("hold")) onHold += count;
  }
  const used = approved + inReview + toBeActioned + onHold;
  return {
    "Approved / Final": approved,
    "In Review": inReview,
    "To Be Actioned": toBeActioned,
    "On Hold": onHold,
    "Others": Math.max(0, total - used)
  };
}

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
  const actionsRaw = update?.progressAnalysis?.distributions.actions ?? actionDistribution;
  const actions: Record<string, number> = {};
  for (const [label, count] of Object.entries(actionsRaw)) {
    const key = normalize(label);
    const display = key.includes("final") ? "Final Document" : key.includes("enka") ? "ENKA to Take Action" : key.includes("taurus") ? "Taurus to Take Action" : key.includes("hold") ? "On Hold" : label;
    actions[display] = (actions[display] ?? 0) + count;
  }
  const statuses = statusSummary(update?.progressAnalysis?.distributions.statuses ?? {}, metrics.totalDocuments);

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">EXECUTIVE OVERVIEW</span><h1>Project Performance Overview</h1><p>Real-time controlled progress, document status, and schedule position.</p></div>
        <button className="secondary-button" type="button">⇩ Export Briefing</button>
      </div>

      <ExecutivePerformanceOverview approvedDocuments={metrics.approved} criticalActivities={metrics.criticalActivities} fallbackCurve={curve} progressSeries={update?.progressAnalysis?.progressSeries ?? []} scheduleActivities={metrics.scheduleActivities} totalDocuments={metrics.totalDocuments} />

      <section className="dashboard-grid lower-grid executive-lower-grid-three">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">DOCUMENT REGISTER</span><h2>Distribution by Discipline</h2></div></div>
          <BarList data={disciplines} />
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">RESPONSIBILITY</span><h2>Current Document Action</h2></div></div>
          <BarList data={actions} />
        </article>
        <article className="panel executive-distribution-panel">
          <div className="panel-heading"><div><span className="eyebrow">DISTRIBUTION SUMMARY</span></div></div>
          <div className="executive-summary-donut-wrap">
            <div className="executive-summary-donut" style={{ background: `conic-gradient(#22c58b 0deg ${(statuses["Approved / Final"] / Math.max(1, metrics.totalDocuments)) * 360}deg, #377de5 ${(statuses["Approved / Final"] / Math.max(1, metrics.totalDocuments)) * 360}deg ${((statuses["Approved / Final"] + statuses["In Review"]) / Math.max(1, metrics.totalDocuments)) * 360}deg, #f1a31b ${((statuses["Approved / Final"] + statuses["In Review"]) / Math.max(1, metrics.totalDocuments)) * 360}deg ${((statuses["Approved / Final"] + statuses["In Review"] + statuses["To Be Actioned"]) / Math.max(1, metrics.totalDocuments)) * 360}deg, #ef5365 ${((statuses["Approved / Final"] + statuses["In Review"] + statuses["To Be Actioned"]) / Math.max(1, metrics.totalDocuments)) * 360}deg ${((statuses["Approved / Final"] + statuses["In Review"] + statuses["To Be Actioned"] + statuses["On Hold"]) / Math.max(1, metrics.totalDocuments)) * 360}deg, #a9c8c3 ${((statuses["Approved / Final"] + statuses["In Review"] + statuses["To Be Actioned"] + statuses["On Hold"]) / Math.max(1, metrics.totalDocuments)) * 360}deg 360deg)` }}>
              <div><strong>{metrics.totalDocuments.toLocaleString()}</strong><span>Total Documents</span></div>
            </div>
            <div className="executive-summary-legend">
              {Object.entries(statuses).map(([label, count], index) => <div key={label}><i className={`summary-dot summary-dot-${index + 1}`} /><span>{label}</span><strong>{count.toLocaleString()} ({metrics.totalDocuments ? ((count / metrics.totalDocuments) * 100).toFixed(1) : "0.0"}%)</strong></div>)}
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

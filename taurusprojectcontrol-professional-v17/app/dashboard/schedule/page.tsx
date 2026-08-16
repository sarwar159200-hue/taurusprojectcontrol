import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { ScheduleExplorer } from "@/components/schedule-explorer";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate, metric } from "@/lib/published-data";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  await requireSection("schedule");
  const update = await getPublishedProjectUpdate({ scheduleActivities: true });
  const snapshot = update?.scheduleAnalysis;
  const summary = snapshot?.summary;
  const activities = snapshot?.scheduleActivities ?? [];
  const statuses = snapshot?.distributions.statuses ?? {};
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">INTEGRATED SCHEDULE</span><h1>Project plan and Gantt</h1><p>WBS, disciplines, sub-disciplines, milestones, float, criticality and progress from the latest Excel schedule.</p></div></div>
      <section className="kpi-grid five">
        <KpiCard label="Schedule rows" value={metric(summary, "rows", 0).toLocaleString()} detail="Including WBS summaries" />
        <KpiCard label="Activities" value={metric(summary, "activities", 0).toLocaleString()} detail="Activities and milestones" tone="blue" />
        <KpiCard label="Critical" value={String(metric(summary, "critical", 0))} detail="Critical flag from the export" tone="red" />
        <KpiCard label="Mapping warnings" value={String(metric(summary, "disciplineErrors", 0))} detail="#N/A discipline rows" tone="amber" />
        <KpiCard label="Forecast finish" value={String(summary?.forecastFinish ?? "—")} detail="Latest current finish" />
      </section>
      {Object.keys(statuses).length ? <section className="panel schedule-status-summary"><div className="panel-heading"><div><span className="eyebrow">ACTIVITY STATUS</span><h2>Schedule distribution</h2></div></div><BarList data={statuses} /></section> : null}
      <ScheduleExplorer activities={activities} dataDate={String(summary?.dataDate ?? update?.dataDate ?? "") || null} />
      <div className="callout"><strong>Excel schedule scope</strong><span>The uploaded file supplies activities, dates, float, progress, disciplines and critical flags. Upload an XER later if you want full Primavera relationships, calendars, constraints and resource logic.</span></div>
    </>
  );
}

import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { dashboardMetrics, scheduleStatus } from "@/lib/demo-data";

const ganttRows = [
  { name: "Project Milestones", start: 4, width: 86, progress: 42, type: "summary" },
  { name: "Engineering", start: 7, width: 52, progress: 64, type: "summary" },
  { name: "Procurement", start: 16, width: 63, progress: 39, type: "summary" },
  { name: "Construction", start: 31, width: 58, progress: 18, type: "critical" },
  { name: "Pre-commissioning", start: 74, width: 13, progress: 0, type: "normal" },
  { name: "Commercial Operation", start: 91, width: 1.5, progress: 0, type: "milestone" }
];

export default function SchedulePage() {
  const m = dashboardMetrics;
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">INTEGRATED SCHEDULE</span><h1>Project plan and Gantt</h1><p>WBS, milestones, float, criticality and progress in one controlled view.</p></div><button className="secondary-button">Open filter panel</button></div>
      <section className="kpi-grid five">
        <KpiCard label="Schedule rows" value={m.scheduleRows.toLocaleString()} detail="Including WBS summaries" />
        <KpiCard label="Activities" value={m.scheduleActivities.toLocaleString()} detail="Activities and milestones" tone="blue" />
        <KpiCard label="Critical" value={String(m.criticalActivities)} detail="Total float ≤ 0" tone="red" />
        <KpiCard label="WBS warnings" value="100" detail="#N/A on activity rows" tone="amber" />
        <KpiCard label="Logic source" value="Excel" detail="XER recommended for Phase 2" />
      </section>
      <section className="dashboard-grid schedule-grid">
        <article className="panel schedule-status-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVITY STATUS</span><h2>Schedule distribution</h2></div></div><BarList data={scheduleStatus} /></article>
        <article className="panel gantt-panel">
          <div className="panel-heading"><div><span className="eyebrow">PROGRAMME VIEW</span><h2>High-level Gantt preview</h2></div><span className="status-pill status-ready">Data date</span></div>
          <div className="gantt-head"><span>WBS / Activity</span><div><i>2025</i><i>2026</i><i>2027</i><i>2028</i></div></div>
          <div className="gantt-body">
            <div className="data-date-line" />
            {ganttRows.map((row) => (
              <div className="gantt-row" key={row.name}>
                <strong>{row.name}</strong>
                <div className="gantt-track">
                  <span className={`gantt-bar ${row.type}`} style={{ left: `${row.start}%`, width: `${row.width}%` }}>
                    {row.progress > 0 ? <i style={{ width: `${row.progress}%` }} /> : null}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <div className="callout"><strong>Why XER is required for the production Gantt</strong><span>The uploaded Excel schedule does not contain predecessors, successors, calendars, constraints or resources. The portal can display it, but should not claim to reproduce the full Primavera logic until the XER parser is connected.</span></div>
    </>
  );
}

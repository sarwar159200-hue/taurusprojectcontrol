"use client";

import { useMemo, useState } from "react";
import type { ScheduleActivityInput } from "@/lib/types";

const PAGE_SIZE = 100;

function displayDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function percent(value: number | null) {
  if (value === null) return "—";
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function validDate(value: string | null): value is string {
  return Boolean(value && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

export function ScheduleExplorer({ activities, dataDate }: { activities: ScheduleActivityInput[]; dataDate: string | null }) {
  const [discipline, setDiscipline] = useState("all");
  const [subdiscipline, setSubdiscipline] = useState("all");
  const [status, setStatus] = useState("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const disciplines = useMemo(() => [...new Set(activities.map((item) => item.discipline))].sort(), [activities]);
  const subdisciplines = useMemo(() => [...new Set(activities.filter((item) => discipline === "all" || item.discipline === discipline).map((item) => item.subdiscipline))].sort(), [activities, discipline]);
  const statuses = useMemo(() => [...new Set(activities.map((item) => item.activityStatus))].sort(), [activities]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return activities.filter((item) =>
      (discipline === "all" || item.discipline === discipline) &&
      (subdiscipline === "all" || item.subdiscipline === subdiscipline) &&
      (status === "all" || item.activityStatus === status) &&
      (!criticalOnly || item.isCritical) &&
      (!search || `${item.activityId} ${item.activityName}`.toLowerCase().includes(search))
    );
  }, [activities, discipline, subdiscipline, status, criticalOnly, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const timeline = useMemo(() => {
    const starts = activities.flatMap((item) => [item.baselineStart, item.currentStart]).filter(validDate);
    const finishes = activities.flatMap((item) => [item.baselineFinish, item.currentFinish]).filter(validDate);
    if (!starts.length || !finishes.length) return [];
    const min = Math.min(...starts.map((value) => Date.parse(`${value}T00:00:00Z`)));
    const max = Math.max(...finishes.map((value) => Date.parse(`${value}T00:00:00Z`)));
    const span = Math.max(86400000, max - min);
    const preferred = ["Milestone", "Mobilization", "Engineering", "Procurement", "Construction"];
    return [...new Set(activities.map((item) => item.discipline))]
      .sort((a, b) => (preferred.indexOf(a) < 0 ? 99 : preferred.indexOf(a)) - (preferred.indexOf(b) < 0 ? 99 : preferred.indexOf(b)))
      .map((name) => {
        const rows = activities.filter((item) => item.discipline === name);
        const rowStarts = rows.flatMap((item) => [item.baselineStart, item.currentStart]).filter(validDate).map((value) => Date.parse(`${value}T00:00:00Z`));
        const rowFinishes = rows.flatMap((item) => [item.baselineFinish, item.currentFinish]).filter(validDate).map((value) => Date.parse(`${value}T00:00:00Z`));
        if (!rowStarts.length || !rowFinishes.length) return null;
        const start = Math.min(...rowStarts);
        const finish = Math.max(...rowFinishes);
        const totalWeight = rows.reduce((sum, item) => sum + Math.max(item.originalDuration ?? 1, 1), 0);
        const progress = totalWeight
          ? rows.reduce((sum, item) => sum + (item.performancePercentComplete ?? 0) * Math.max(item.originalDuration ?? 1, 1), 0) / totalWeight
          : 0;
        return { name, left: ((start - min) / span) * 100, width: Math.max(0.8, ((finish - start) / span) * 100), progress: Math.max(0, Math.min(100, progress <= 1 ? progress * 100 : progress)) };
      }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [activities]);

  if (!activities.length) return <div className="callout"><strong>No published schedule</strong><span>Upload `Project Schedule-Taurus.xlsx` from Import & Publish. The activity plan will then appear here automatically.</span></div>;

  function resetPage() { setPage(0); }

  return (
    <>
      <section className="panel gantt-panel live-gantt-panel">
        <div className="panel-heading"><div><span className="eyebrow">PROGRAMME VIEW</span><h2>Discipline-level Gantt</h2></div><span className="status-pill status-ready">Data date {displayDate(dataDate)}</span></div>
        <div className="live-gantt">
          {timeline.map((row) => <div className="gantt-row" key={row.name}><strong>{row.name}</strong><div className="gantt-track"><span className="gantt-bar summary" style={{ left: `${row.left}%`, width: `${row.width}%` }}><i style={{ width: `${row.progress}%` }} /></span></div></div>)}
        </div>
      </section>

      <section className="panel schedule-table-panel">
        <div className="panel-heading"><div><span className="eyebrow">FULL PROJECT PLAN</span><h2>All schedule activities</h2></div><span className="status-pill status-ready">{filtered.length.toLocaleString()} rows</span></div>
        <div className="schedule-filter-grid">
          <label><span>Discipline</span><select value={discipline} onChange={(event) => { setDiscipline(event.target.value); setSubdiscipline("all"); resetPage(); }}><option value="all">All disciplines</option>{disciplines.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Sub-discipline</span><select value={subdiscipline} onChange={(event) => { setSubdiscipline(event.target.value); resetPage(); }}><option value="all">All sub-disciplines</option>{subdisciplines.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Search</span><input value={query} placeholder="Activity ID or name" onChange={(event) => { setQuery(event.target.value); resetPage(); }} /></label>
          <label className="critical-filter"><input checked={criticalOnly} type="checkbox" onChange={(event) => { setCriticalOnly(event.target.checked); resetPage(); }} /><span>Critical only</span></label>
        </div>
        <div className="responsive-table"><table className="schedule-activity-table"><thead><tr><th>Activity ID</th><th>Activity name</th><th>Discipline</th><th>Sub-discipline</th><th>Status</th><th>Start</th><th>Finish</th><th>Schedule</th><th>Performance</th><th>Total float</th><th>Critical</th></tr></thead><tbody>
          {visible.map((item) => <tr key={`${item.activityId}-${item.sourceRow}`}><td><strong>{item.activityId}</strong></td><td>{item.activityName}</td><td>{item.discipline}</td><td>{item.subdiscipline}</td><td>{item.activityStatus}</td><td>{displayDate(item.currentStart)}</td><td>{displayDate(item.currentFinish)}</td><td>{percent(item.schedulePercentComplete)}</td><td>{percent(item.performancePercentComplete)}</td><td>{item.totalFloat ?? "—"}</td><td>{item.isCritical ? <span className="status-pill status-error">Yes</span> : "No"}</td></tr>)}
          {!visible.length ? <tr><td colSpan={11} className="empty-table-cell">No activities match these filters.</td></tr> : null}
        </tbody></table></div>
        <div className="table-pagination"><span>Page {safePage + 1} of {pages}</span><div><button className="secondary-button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>Previous</button><button className="secondary-button" disabled={safePage >= pages - 1} onClick={() => setPage(Math.min(pages - 1, safePage + 1))}>Next</button></div></div>
      </section>
    </>
  );
}

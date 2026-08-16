"use client";

import { useMemo, useState } from "react";
import type { ScheduleActivityInput } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";

const PAGE_SIZE = 100;

function displayDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
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
  const { locale, t } = useLanguage();
  const dateLocale = locale === "ku" ? "ckb-IQ" : locale === "ar" ? "ar-IQ" : "en-GB";
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

  if (!activities.length) return <div className="callout"><strong>{t("No published schedule")}</strong><span>{t("Upload the schedule workbook from Import & Publish. The activity plan will then appear here automatically.")}</span></div>;

  function resetPage() { setPage(0); }

  return (
    <>
      <section className="panel gantt-panel live-gantt-panel">
        <div className="panel-heading"><div><span className="eyebrow">{t("PROGRAMME VIEW")}</span><h2>{t("Discipline-level Gantt")}</h2></div><span className="status-pill status-ready">{t("Data date")} {displayDate(dataDate, dateLocale)}</span></div>
        <div className="live-gantt">
          {timeline.map((row) => <div className="gantt-row" key={row.name}><strong>{t(row.name)}</strong><div className="gantt-track"><span className="gantt-bar summary" style={{ left: `${row.left}%`, width: `${row.width}%` }}><i style={{ width: `${row.progress}%` }} /></span></div></div>)}
        </div>
      </section>

      <section className="panel schedule-table-panel">
        <div className="panel-heading"><div><span className="eyebrow">{t("FULL PROJECT PLAN")}</span><h2>{t("All schedule activities")}</h2></div><span className="status-pill status-ready">{filtered.length.toLocaleString(dateLocale)} {t("rows")}</span></div>
        <div className="schedule-filter-grid">
          <label><span>{t("Discipline")}</span><select value={discipline} onChange={(event) => { setDiscipline(event.target.value); setSubdiscipline("all"); resetPage(); }}><option value="all">{t("All disciplines")}</option>{disciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
          <label><span>{t("Sub-discipline")}</span><select value={subdiscipline} onChange={(event) => { setSubdiscipline(event.target.value); resetPage(); }}><option value="all">{t("All sub-disciplines")}</option>{subdisciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
          <label><span>{t("Status")}</span><select value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="all">{t("All statuses")}</option>{statuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
          <label><span>{t("Search")}</span><input value={query} placeholder={t("Activity ID or name")} onChange={(event) => { setQuery(event.target.value); resetPage(); }} /></label>
          <label className="critical-filter"><input checked={criticalOnly} type="checkbox" onChange={(event) => { setCriticalOnly(event.target.checked); resetPage(); }} /><span>{t("Critical only")}</span></label>
        </div>
        <div className="responsive-table"><table className="schedule-activity-table"><thead><tr><th>{t("Activity ID")}</th><th>{t("Activity name")}</th><th>{t("Discipline")}</th><th>{t("Sub-discipline")}</th><th>{t("Status")}</th><th>{t("Start")}</th><th>{t("Finish")}</th><th>{t("Schedule")}</th><th>{t("Performance")}</th><th>{t("Total float")}</th><th>{t("Critical")}</th></tr></thead><tbody>
          {visible.map((item) => <tr key={`${item.activityId}-${item.sourceRow}`}><td><strong>{item.activityId}</strong></td><td>{item.activityName}</td><td>{t(item.discipline)}</td><td>{t(item.subdiscipline)}</td><td>{t(item.activityStatus)}</td><td>{displayDate(item.currentStart, dateLocale)}</td><td>{displayDate(item.currentFinish, dateLocale)}</td><td>{percent(item.schedulePercentComplete)}</td><td>{percent(item.performancePercentComplete)}</td><td>{item.totalFloat ?? "—"}</td><td>{item.isCritical ? <span className="status-pill status-error">{t("Yes")}</span> : t("No")}</td></tr>)}
          {!visible.length ? <tr><td colSpan={11} className="empty-table-cell">{t("No activities match these filters.")}</td></tr> : null}
        </tbody></table></div>
        <div className="table-pagination"><span>{t("Page")} {safePage + 1} {t("of")} {pages}</span><div><button className="secondary-button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>{t("Previous")}</button><button className="secondary-button" disabled={safePage >= pages - 1} onClick={() => setPage(Math.min(pages - 1, safePage + 1))}>{t("Next")}</button></div></div>
      </section>
    </>
  );
}

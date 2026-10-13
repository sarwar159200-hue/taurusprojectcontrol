"use client";

import { useMemo, useState } from "react";
import type { ScheduleActivityInput } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";
import { KpiCard } from "@/components/kpi-card";

const PAGE_SIZE = 10;

type StatusBucket = "Not Started" | "Completed" | "In Progress" | "Not Planned";

function displayDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function pctValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
}

function percent(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return `${pctValue(value).toFixed(digits)}%`;
}

function statusBucket(item: ScheduleActivityInput): StatusBucket {
  const value = item.activityStatus.toLowerCase();
  if (value.includes("complete") || value.includes("finish")) return "Completed";
  if (value.includes("progress") || value.includes("active") || value.includes("started")) return "In Progress";
  if (value.includes("not planned") || value.includes("unplanned")) return "Not Planned";
  return "Not Started";
}

function isMilestone(item: ScheduleActivityInput) {
  return item.activityType.toLowerCase().includes("milestone") || item.discipline.toLowerCase().includes("milestone");
}

function weightedProgress(items: ScheduleActivityInput[]) {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(item.originalDuration ?? 1, 1), 0);
  if (!totalWeight) return 0;
  return items.reduce((sum, item) => sum + pctValue(item.performancePercentComplete) * Math.max(item.originalDuration ?? 1, 1), 0) / totalWeight;
}

function normalDiscipline(item: ScheduleActivityInput) {
  if (isMilestone(item)) return "Milestone";
  return item.discipline || "Other";
}

function toneFor(name: string) {
  const key = name.toLowerCase();
  if (key.includes("milestone") || key.includes("complete")) return "green";
  if (key.includes("engineering")) return "blue";
  if (key.includes("procurement")) return "purple";
  if (key.includes("construction") || key.includes("progress")) return "amber";
  if (key.includes("critical")) return "red";
  return "slate";
}

export function ScheduleExplorer({ activities, dataDate, forecastFinish, mappingWarnings, scheduleRows }: {
  activities: ScheduleActivityInput[];
  dataDate: string | null;
  forecastFinish: string;
  mappingWarnings: number;
  scheduleRows: number;
}) {
  const { locale, t } = useLanguage();
  const dateLocale = locale === "ku" ? "ckb-IQ" : locale === "ar" ? "ar-IQ" : "en-GB";
  const [discipline, setDiscipline] = useState("all");
  const [subdiscipline, setSubdiscipline] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [performanceView, setPerformanceView] = useState<"discipline" | "subdiscipline">("discipline");
  const [performanceMetric, setPerformanceMetric] = useState<"performance" | "schedule">("performance");
  const [wbsSearch, setWbsSearch] = useState("");
  const [drilldown, setDrilldown] = useState<{ title: string; rows: ScheduleActivityInput[] } | null>(null);
  const [exporting, setExporting] = useState(false);

  const disciplines = useMemo(() => [...new Set(activities.map(normalDiscipline))].sort(), [activities]);
  const subdisciplines = useMemo(() => [...new Set(activities.filter((item) => discipline === "all" || normalDiscipline(item) === discipline).map((item) => item.subdiscipline).filter(Boolean))].sort(), [activities, discipline]);
  const statuses = useMemo(() => [...new Set(activities.map((item) => item.activityStatus).filter(Boolean))].sort(), [activities]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return activities.filter((item) =>
      (discipline === "all" || normalDiscipline(item) === discipline) &&
      (subdiscipline === "all" || item.subdiscipline === subdiscipline) &&
      (status === "all" || item.activityStatus === status) &&
      (!search || `${item.activityId} ${item.activityName} ${item.discipline} ${item.subdiscipline}`.toLowerCase().includes(search))
    );
  }, [activities, discipline, subdiscipline, status, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const statusSummary = useMemo(() => {
    const buckets: Record<StatusBucket, number> = { "Not Started": 0, Completed: 0, "In Progress": 0, "Not Planned": 0 };
    activities.forEach((item) => { buckets[statusBucket(item)] += 1; });
    return buckets;
  }, [activities]);

  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    activities.forEach((item) => map.set(normalDiscipline(item), (map.get(normalDiscipline(item)) ?? 0) + 1));
    const preferred = ["Milestone", "Engineering", "Procurement", "Construction"];
    return [...map.entries()].sort((a, b) => {
      const ai = preferred.indexOf(a[0]); const bi = preferred.indexOf(b[0]);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return b[1] - a[1];
    }).slice(0, 6);
  }, [activities]);

  const performanceRows = useMemo(() => {
    const map = new Map<string, ScheduleActivityInput[]>();
    activities.forEach((item) => {
      const key = performanceView === "discipline" ? normalDiscipline(item) : (item.subdiscipline || normalDiscipline(item));
      const rows = map.get(key) ?? [];
      rows.push(item); map.set(key, rows);
    });
    return [...map.entries()].map(([name, rows]) => ({
      name,
      value: performanceMetric === "performance"
        ? weightedProgress(rows)
        : rows.reduce((sum, item) => sum + pctValue(item.schedulePercentComplete), 0) / Math.max(rows.length, 1)
    })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [activities, performanceView, performanceMetric]);

  const wbsRows = useMemo(() => {
    const map = new Map<string, ScheduleActivityInput[]>();
    activities.forEach((item) => {
      const key = normalDiscipline(item);
      const rows = map.get(key) ?? []; rows.push(item); map.set(key, rows);
    });
    const rows: Array<{ code: string; name: string; level: number; activities: number; progress: number; tone: string }> = [
      { code: "1", name: "Bazian II Power Plant Conversion Project", level: 1, activities: activities.length, progress: weightedProgress(activities), tone: "green" }
    ];
    [...map.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 7).forEach(([name, items], index) => {
      rows.push({ code: `1.${index + 1}`, name, level: 2, activities: items.length, progress: weightedProgress(items), tone: toneFor(name) });
      if (name.toLowerCase().includes("engineering")) {
        [...new Set(items.map((item) => item.subdiscipline).filter(Boolean))].slice(0, 5).forEach((sub, subIndex) => {
          const subItems = items.filter((item) => item.subdiscipline === sub);
          rows.push({ code: `1.${index + 1}.${subIndex + 1}`, name: sub, level: 3, activities: subItems.length, progress: weightedProgress(subItems), tone: toneFor(sub) });
        });
      }
    });
    const q = wbsSearch.trim().toLowerCase();
    return q ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(q)) : rows;
  }, [activities, wbsSearch]);

  const wbsCount = useMemo(() => {
    const paths = new Set<string>();
    activities.forEach((item) => {
      if (item.wbsPath) paths.add(item.wbsPath);
      paths.add(normalDiscipline(item));
      if (item.subdiscipline) paths.add(`${normalDiscipline(item)}>${item.subdiscipline}`);
    });
    return paths.size;
  }, [activities]);

  const criticalRows = useMemo(() => activities.filter((item) => item.isCritical), [activities]);
  const mappingWarningRows = useMemo(() => activities.filter((item) => !item.discipline || normalDiscipline(item) === "Other"), [activities]);
  const latestFinish = useMemo(() => activities.map((item) => item.currentFinish).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null, [activities]);
  const forecastRows = useMemo(() => latestFinish ? activities.filter((item) => item.currentFinish === latestFinish) : [], [activities, latestFinish]);

  function openDrilldown(title: string, rows: ScheduleActivityInput[]) {
    setDrilldown({ title, rows });
  }

  async function exportDrilldown() {
    if (!drilldown?.rows.length || exporting) return;
    setExporting(true);
    try {
      const response = await fetch("/api/export/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: drilldown.title, rows: drilldown.rows })
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? "taurus-schedule-drilldown.xlsx";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (!activities.length) return <div className="callout"><strong>{t("No published schedule")}</strong><span>{t("Upload the schedule workbook from Import & Publish. The activity plan will then appear here automatically.")}</span></div>;

  const total = activities.length;
  const statusOrder: StatusBucket[] = ["Not Started", "Completed", "In Progress", "Not Planned"];

  return (
    <div className="schedule-command-center">
      <section className="kpi-grid five schedule-reference-kpis schedule-clickable-kpis">
        <KpiCard label={t("Schedule Rows")} value={scheduleRows.toLocaleString(dateLocale)} detail={t("Including WBS summaries · Click to view activity rows")} onClick={() => openDrilldown(t("Schedule Rows"), activities)} />
        <KpiCard label={t("Activities")} value={activities.length.toLocaleString(dateLocale)} detail={t("Activities & milestones · Click to view list")} tone="blue" onClick={() => openDrilldown(t("Activities"), activities)} />
        <KpiCard label={t("Critical Activities")} value={criticalRows.length.toLocaleString(dateLocale)} detail={t("Critical flag from export · Click to view list")} tone="red" onClick={() => openDrilldown(t("Critical Activities"), criticalRows)} />
        <KpiCard label={t("Mapping Warnings")} value={mappingWarnings.toLocaleString(dateLocale)} detail={t("Discipline rows · Click to view list")} tone="amber" onClick={() => openDrilldown(t("Mapping Warnings"), mappingWarningRows)} />
        <KpiCard label={t("Forecast Finish")} value={forecastFinish} detail={t("Latest current finish · Click to view driving finish rows")} tone="green" onClick={() => openDrilldown(t("Forecast Finish"), forecastRows)} />
      </section>
      <section className="schedule-overview-grid">
        <article className="panel schedule-status-card">
          <div className="schedule-card-title">{t("ACTIVITY STATUS OVERVIEW")} <span className="schedule-info-dot">i</span></div>
          <div className="schedule-status-stack">
            {statusOrder.map((name) => <button aria-label={`${t(name)} ${statusSummary[name]}`} key={name} className={`schedule-status-segment ${toneFor(name)}`} onClick={() => openDrilldown(t(name), activities.filter((item) => statusBucket(item) === name))} style={{ width: `${(statusSummary[name] / Math.max(total, 1)) * 100}%` }} type="button" />)}
          </div>
          <div className="schedule-status-metrics">
            {statusOrder.map((name) => <button key={name} onClick={() => openDrilldown(t(name), activities.filter((item) => statusBucket(item) === name))} type="button"><span className={`schedule-dot ${toneFor(name)}`} /> <small>{t(name)}</small><strong>{statusSummary[name].toLocaleString(dateLocale)}</strong><em>{((statusSummary[name] / Math.max(total, 1)) * 100).toFixed(2)}%</em></button>)}
          </div>
        </article>

        <article className="panel schedule-performance-card">
          <div className="schedule-performance-head"><span>{t("PERFORMANCE SNAPSHOT")}</span><div className="schedule-mini-selects"><label>{t("View by")}<select value={performanceView} onChange={(e) => setPerformanceView(e.target.value as "discipline" | "subdiscipline")}><option value="discipline">{t("Discipline")}</option><option value="subdiscipline">{t("Sub-discipline")}</option></select></label><label>{t("Metric")}<select value={performanceMetric} onChange={(e) => setPerformanceMetric(e.target.value as "performance" | "schedule")}><option value="performance">{t("% Complete")}</option><option value="schedule">{t("Schedule %")}</option></select></label></div></div>
          <div className="schedule-performance-bars">{performanceRows.map((row) => <button key={row.name} className="schedule-performance-row" onClick={() => openDrilldown(`${t("Performance Snapshot")} — ${t(row.name)}`, activities.filter((item) => (performanceView === "discipline" ? normalDiscipline(item) : (item.subdiscipline || normalDiscipline(item))) === row.name))} type="button"><span>{t(row.name)}</span><div><i className={toneFor(row.name)} style={{ width: `${row.value}%` }} /></div><strong>{row.value.toFixed(1)}%</strong></button>)}</div>
        </article>

        <article className="panel schedule-distribution-card">
          <div className="schedule-card-title">{t("ACTIVITY DISTRIBUTION")}</div>
          <div className="schedule-donut-layout">
            <div className="schedule-donut" style={{ background: `conic-gradient(${distribution.map(([name, count], i) => `${["#43d391", "#3e8cff", "#8455d9", "#f5a21a", "#ec5865", "#93a9bd"][i % 6]} ${i === 0 ? 0 : distribution.slice(0, i).reduce((s, [, c]) => s + c, 0) / total * 100}% ${distribution.slice(0, i + 1).reduce((s, [, c]) => s + c, 0) / total * 100}%`).join(",")})` }}><div><strong>{total.toLocaleString(dateLocale)}</strong><span>{t("Total Activities")}</span></div></div>
            <div className="schedule-donut-legend">{distribution.map(([name, count], i) => <button key={name} onClick={() => openDrilldown(`${t("Activity Distribution")} — ${t(name)}`, activities.filter((item) => normalDiscipline(item) === name))} type="button"><span style={{ background: ["#43d391", "#3e8cff", "#8455d9", "#f5a21a", "#ec5865", "#93a9bd"][i % 6] }} /><em>{t(name)}</em><strong>{((count / total) * 100).toFixed(1)}% ({count.toLocaleString(dateLocale)})</strong></button>)}<hr /><button className="critical-legend" onClick={() => openDrilldown(t("Critical Activities"), criticalRows)} type="button"><span /> <em>{t("Critical Activities")}: {criticalRows.length.toLocaleString(dateLocale)}</em></button></div>
          </div>
        </article>
      </section>

      <section className="schedule-detail-grid">
        <article className="panel wbs-panel">
          <div className="schedule-section-head"><div><span>{t("WBS STRUCTURE")}</span></div><b>{wbsCount.toLocaleString(dateLocale)} {t("WBS ELEMENTS")}</b></div>
          <div className="wbs-toolbar"><input value={wbsSearch} onChange={(e) => setWbsSearch(e.target.value)} placeholder={t("Search WBS...")} /><select defaultValue="all"><option value="all">{t("All Levels")}</option></select></div>
          <div className="wbs-table"><div className="wbs-row wbs-header"><span>{t("WBS CODE")}</span><span>{t("WBS NAME")}</span><span>{t("LEVEL")}</span><span>{t("ACTIVITIES")}</span><span>{t("% COMPLETE")}</span></div>{wbsRows.map((row) => <div className="wbs-row" key={`${row.code}-${row.name}`}><span>{row.code}</span><strong style={{ paddingLeft: `${(row.level - 1) * 12}px` }}><i className={`wbs-folder ${row.tone}`} />{t(row.name)}</strong><span>{row.level}</span><span>{row.activities.toLocaleString(dateLocale)}</span><span><i className="wbs-progress"><b className={row.tone} style={{ width: `${row.progress}%` }} /></i>{row.progress.toFixed(1)}%</span></div>)}</div>
          <button type="button" className="schedule-full-wbs-button">{t("View Full WBS")}</button>
        </article>

        <article className="panel schedule-activities-panel">
          <div className="schedule-section-head"><div><span>{t("ALL SCHEDULE ACTIVITIES")}</span></div><b>{filtered.length.toLocaleString(dateLocale)} {t("ROWS")}</b></div>
          <div className="schedule-inline-filters">
            <label><span>{t("Discipline")}</span><select value={discipline} onChange={(e) => { setDiscipline(e.target.value); setSubdiscipline("all"); setPage(0); }}><option value="all">{t("All Disciplines")}</option>{disciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
            <label><span>{t("Sub-Discipline")}</span><select value={subdiscipline} onChange={(e) => { setSubdiscipline(e.target.value); setPage(0); }}><option value="all">{t("All Sub-Disciplines")}</option>{subdisciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
            <label><span>{t("Status")}</span><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="all">{t("All Statuses")}</option>{statuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
            <label className="schedule-search-field"><span>&nbsp;</span><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder={t("Search activity ID or name...")} /></label>
            <button type="button" className="secondary-button" onClick={() => { setDiscipline("all"); setSubdiscipline("all"); setStatus("all"); setQuery(""); setPage(0); }}>{t("Filters")}</button>
          </div>
          <div className="responsive-table schedule-reference-table"><table><thead><tr><th>{t("Activity ID")}</th><th>{t("Activity Name")}</th><th>{t("Discipline")}</th><th>{t("Sub-Discipline")}</th><th>{t("Status")}</th><th>{t("Start")}</th><th>{t("Finish")}</th><th>{t("% Complete")}</th><th>{t("Critical")}</th></tr></thead><tbody>{visible.map((item) => <tr key={`${item.activityId}-${item.sourceRow}`}><td><strong>{item.activityId}</strong></td><td>{item.activityName}</td><td>{t(normalDiscipline(item))}</td><td>{t(item.subdiscipline || "—")}</td><td><span className={`schedule-status-pill ${toneFor(statusBucket(item))}`}>{t(statusBucket(item))}</span></td><td>{displayDate(item.currentStart, dateLocale)}</td><td>{displayDate(item.currentFinish, dateLocale)}</td><td>{percent(item.performancePercentComplete, 0)}</td><td>{item.isCritical ? <span className="schedule-critical-yes">{t("Yes")}</span> : t("No")}</td></tr>)}</tbody></table></div>
          <div className="schedule-table-footer"><span>{t("Showing")} {filtered.length ? safePage * PAGE_SIZE + 1 : 0} {t("to")} {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} {t("of")} {filtered.length.toLocaleString(dateLocale)} {t("entries")}</span><div className="schedule-pagination"><button disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>‹</button>{Array.from({ length: Math.min(5, pages) }, (_, i) => i).map((i) => <button key={i} className={safePage === i ? "active" : ""} onClick={() => setPage(i)}>{i + 1}</button>)}{pages > 6 ? <span>…</span> : null}{pages > 5 ? <button onClick={() => setPage(pages - 1)}>{pages}</button> : null}<button disabled={safePage >= pages - 1} onClick={() => setPage(Math.min(pages - 1, safePage + 1))}>›</button></div></div>
        </article>
      </section>
      <div className="schedule-data-date-note">{t("Data date")}: {displayDate(dataDate, dateLocale)}</div>
      {drilldown ? (
        <div className="dc-drilldown-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDrilldown(null); }}>
          <section aria-modal="true" className="dc-drilldown-modal schedule-drilldown-modal" role="dialog">
            <div className="dc-drilldown-heading">
              <div><span className="eyebrow">{t("PROJECT SCHEDULE DRILL-DOWN")}</span><h2>{drilldown.title}</h2><p>{drilldown.rows.length.toLocaleString(dateLocale)} {t("schedule activities")}</p></div>
              <div className="dc-drilldown-actions"><button className="primary-button" disabled={!drilldown.rows.length || exporting} onClick={() => void exportDrilldown()} type="button">⇩ {exporting ? t("Preparing Excel…") : t("Export Excel")}</button><button aria-label={t("Close")} className="dc-modal-close" onClick={() => setDrilldown(null)} type="button">×</button></div>
            </div>
            <div className="responsive-table"><table><thead><tr><th>{t("Activity ID")}</th><th>{t("Activity Name")}</th><th>{t("Discipline")}</th><th>{t("Sub-Discipline")}</th><th>{t("Status")}</th><th>{t("Start")}</th><th>{t("Finish")}</th><th>{t("% Complete")}</th><th>{t("Critical")}</th></tr></thead><tbody>{drilldown.rows.slice(0, 500).map((item) => <tr key={`${item.activityId}-${item.sourceRow}`}><td><strong>{item.activityId}</strong></td><td>{item.activityName}</td><td>{t(normalDiscipline(item))}</td><td>{t(item.subdiscipline || "—")}</td><td>{t(statusBucket(item))}</td><td>{displayDate(item.currentStart, dateLocale)}</td><td>{displayDate(item.currentFinish, dateLocale)}</td><td>{percent(item.performancePercentComplete, 0)}</td><td>{item.isCritical ? t("Yes") : t("No")}</td></tr>)}</tbody></table></div>
            <div className="dc-drilldown-footer"><span>{drilldown.rows.length > 500 ? `${t("Showing first")} 500 ${t("rows on screen; Excel contains the complete selection.")}` : `${drilldown.rows.length.toLocaleString(dateLocale)} ${t("rows")}`}</span></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

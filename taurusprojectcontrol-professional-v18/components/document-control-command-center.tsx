"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import type { DocumentRecordInput } from "@/lib/types";

type Props = {
  documents: DocumentRecordInput[];
  dataDate?: string | null;
};

type LiveDocument = DocumentRecordInput & {
  liveDueDate: string | null;
  liveResponsible: string;
  liveOverdueDays: number;
  liveDaysUntilDue: number | null;
};

const DAY = 86_400_000;
const PAGE_SIZE = 10;

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseDate(value: string | null | undefined) {
  if (!value || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
}

function addDays(value: string | null | undefined, days: number) {
  const time = parseDate(value);
  if (time === null) return null;
  return new Date(time + days * DAY).toISOString().slice(0, 10);
}

function dayDifference(from: string | null | undefined, to: string | null | undefined) {
  const start = parseDate(from);
  const finish = parseDate(to);
  if (start === null || finish === null) return null;
  return Math.floor((finish - start) / DAY);
}

function responsibleFor(row: DocumentRecordInput) {
  if (row.responsibleParty) return row.responsibleParty;
  const action = normalized(row.currentAction);
  if (action.includes("taurus")) return "Taurus";
  if (action.includes("enka")) return "ENKA";
  if (action.includes("hold")) return "On Hold";
  if (action.includes("final")) return "Closed";
  return "Unassigned";
}

function dueFor(row: DocumentRecordInput, responsible: string) {
  if (row.dueDate) return row.dueDate;
  if (responsible === "Taurus") return addDays(row.lastSubmissionDate, 14);
  if (responsible === "ENKA") return addDays(row.lastResponseDate, 14);
  return null;
}

function dateLabel(value: string | null, locale: string) {
  const time = parseDate(value);
  if (time === null) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(time);
}

function groupStatus(value: string) {
  const status = normalized(value);
  if (status.startsWith("a-approved")) return "Approved";
  if (status.startsWith("b-approved")) return "Approved with comments";
  if (status.includes("awaiting review")) return "Under review";
  if (status.startsWith("c-revise")) return "Revise & resubmit";
  return "Other";
}

function reviewStage(row: LiveDocument) {
  if (row.liveResponsible === "Taurus") return "Taurus review";
  if (row.liveResponsible === "ENKA") return "ENKA incorporation";
  if (row.liveResponsible === "Closed") return "Final document";
  if (row.liveResponsible === "On Hold") return "On hold";
  return "Unassigned";
}

function reviewCycle(row: DocumentRecordInput) {
  if (row.reviewCycleDays !== null && row.reviewCycleDays >= 0) return row.reviewCycleDays;
  const days = dayDifference(row.lastSubmissionDate, row.lastResponseDate);
  return days !== null && days >= 0 ? days : null;
}

function DonutChart({ values, total, translate }: { values: Array<{ label: string; value: number; color: string }>; total: number; translate: (value: string) => string }) {
  let running = 0;
  const stops = values.map((item) => {
    const start = total ? (running / total) * 360 : 0;
    running += item.value;
    const finish = total ? (running / total) * 360 : 0;
    return `${item.color} ${start}deg ${finish}deg`;
  }).join(", ");
  const approved = values.find((item) => item.label === "Approved")?.value ?? 0;
  const approvedPercent = total ? (approved / total) * 100 : 0;
  return (
    <div className="dc-donut-layout">
      <div className="dc-donut" style={{ background: `conic-gradient(${stops || "#d9e2ec 0deg 360deg"})` }}>
        <div><strong>{approvedPercent.toFixed(1)}%</strong><span>{translate("Approved")}</span></div>
      </div>
      <div className="dc-donut-legend">
        {values.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{translate(item.label)}</span><strong>{item.value.toLocaleString()}</strong></div>)}
      </div>
    </div>
  );
}

function ReviewPerformance({ rows, locale, translate }: { rows: LiveDocument[]; locale: string; translate: (value: string) => string }) {
  const today = new Date();
  const weekEnd = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = weekEnd - (11 - index) * 7 * DAY;
    const finish = start + 7 * DAY;
    const submitted = rows.filter((row) => {
      const time = parseDate(row.lastSubmissionDate);
      return time !== null && time >= start && time < finish;
    }).length;
    const reviewed = rows.filter((row) => {
      const time = parseDate(row.lastResponseDate);
      return time !== null && time >= start && time < finish;
    }).length;
    const cycles = rows.map(reviewCycle).filter((value): value is number => value !== null);
    const cycle = cycles.length ? cycles.reduce((sum, value) => sum + value, 0) / cycles.length : 0;
    return { start, submitted, reviewed, cycle };
  });
  const max = Math.max(1, ...weeks.flatMap((week) => [week.submitted, week.reviewed]));
  const width = 720;
  const height = 250;
  const left = 42;
  const top = 28;
  const bottom = 48;
  const plotHeight = height - top - bottom;
  const step = (width - left - 16) / Math.max(1, weeks.length - 1);
  const points = (key: "submitted" | "reviewed") => weeks.map((week, index) => `${left + index * step},${top + plotHeight - (week[key] / max) * plotHeight}`).join(" ");
  return (
    <div className="dc-review-chart">
      <div className="dc-chart-legend"><span className="planned">{translate("ENKA submissions")}</span><span className="actual">{translate("Taurus responses")}</span><span className="target">{translate("14-day target")}</span></div>
      <svg aria-label={translate("Review performance over the last 12 weeks")} role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, .25, .5, .75, 1].map((value) => <line className="dc-chart-grid" key={value} x1={left} x2={width - 8} y1={top + plotHeight * value} y2={top + plotHeight * value} />)}
        {weeks.map((week, index) => {
          const x = left + index * step;
          const barHeight = (week.reviewed / max) * plotHeight;
          return <rect className="dc-review-bar" height={barHeight} key={week.start} rx="3" width="18" x={x - 9} y={top + plotHeight - barHeight} />;
        })}
        <polyline className="dc-line-submitted" fill="none" points={points("submitted")} />
        <polyline className="dc-line-reviewed" fill="none" points={points("reviewed")} />
        {weeks.map((week, index) => <text className="dc-axis-text" key={`label-${week.start}`} textAnchor="middle" x={left + index * step} y={height - 18}>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(week.start)}</text>)}
      </svg>
    </div>
  );
}

export function DocumentControlCommandCenter({ documents, dataDate }: Props) {
  const { locale, t } = useLanguage();
  const numberLocale = locale === "ku" ? "ckb-IQ" : locale === "ar" ? "ar-IQ" : "en-GB";
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All");
  const [status, setStatus] = useState("All");
  const [responsible, setResponsible] = useState("All");
  const [stage, setStage] = useState("All");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [page, setPage] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const liveDocuments = useMemo<LiveDocument[]>(() => documents.map((row) => {
    const liveResponsible = responsibleFor(row);
    const liveDueDate = dueFor(row, liveResponsible);
    const signedDays = liveDueDate ? dayDifference(today, liveDueDate) : null;
    return {
      ...row,
      liveDueDate,
      liveResponsible,
      liveOverdueDays: signedDays !== null && signedDays < 0 ? Math.abs(signedDays) : 0,
      liveDaysUntilDue: signedDays
    };
  }), [documents, today]);

  const mdrDataDate = useMemo(() => {
    const dates = liveDocuments.flatMap((row) => [row.transmittalDate, row.lastSubmissionDate, row.lastResponseDate])
      .filter((value): value is string => parseDate(value) !== null)
      .sort();
    return dates.at(-1) ?? dataDate ?? null;
  }, [liveDocuments, dataDate]);

  const disciplines = useMemo(() => Array.from(new Set(liveDocuments.map((row) => row.discipline).filter(Boolean))).sort(), [liveDocuments]);
  const statuses = useMemo(() => Array.from(new Set(liveDocuments.map((row) => groupStatus(row.lastStatus))).values()).sort(), [liveDocuments]);
  const filtered = useMemo(() => liveDocuments.filter((row) => {
    const searchable = [
      row.documentNo, row.title, row.systemDivision, row.documentType, row.discipline,
      row.subdiscipline, row.revision, row.purpose, row.lastStatus, row.currentAction,
      row.liveResponsible, row.liveDueDate, row.delayAnalysis, row.transmittalNo,
      row.transmittalDate, row.driveWebUrl, reviewStage(row), row.liveOverdueDays
    ].join(" ").toLowerCase();
    return (!query || searchable.includes(query.toLowerCase()))
      && (discipline === "All" || row.discipline === discipline)
      && (status === "All" || groupStatus(row.lastStatus) === status)
      && (responsible === "All" || row.liveResponsible === responsible)
      && (stage === "All" || reviewStage(row) === stage)
      && (!dueFrom || Boolean(row.liveDueDate && row.liveDueDate >= dueFrom))
      && (!dueTo || Boolean(row.liveDueDate && row.liveDueDate <= dueTo));
  }), [liveDocuments, query, discipline, status, responsible, stage, dueFrom, dueTo]);

  const total = filtered.length;
  const approved = filtered.filter((row) => groupStatus(row.lastStatus) === "Approved").length;
  const underReview = filtered.filter((row) => groupStatus(row.lastStatus) === "Under review").length;
  const overdueRows = filtered.filter((row) => row.liveOverdueDays > 0);
  const dueNextSeven = filtered.filter((row) => row.liveDaysUntilDue !== null && row.liveDaysUntilDue >= 0 && row.liveDaysUntilDue <= 7);
  const cycles = filtered.map(reviewCycle).filter((value): value is number => value !== null && value <= 365);
  const averageCycle = cycles.length ? cycles.reduce((sum, value) => sum + value, 0) / cycles.length : 0;
  const statusValues = [
    { label: "Approved", value: filtered.filter((row) => groupStatus(row.lastStatus) === "Approved").length, color: "#22c58b" },
    { label: "Approved with comments", value: filtered.filter((row) => groupStatus(row.lastStatus) === "Approved with comments").length, color: "#65d9af" },
    { label: "Under review", value: filtered.filter((row) => groupStatus(row.lastStatus) === "Under review").length, color: "#377de5" },
    { label: "Revise & resubmit", value: filtered.filter((row) => groupStatus(row.lastStatus) === "Revise & resubmit").length, color: "#f04f5f" },
    { label: "Other", value: filtered.filter((row) => groupStatus(row.lastStatus) === "Other").length, color: "#f1b436" }
  ].filter((item) => item.value > 0);

  const disciplineAging = useMemo(() => {
    const grouped = new Map<string, [number, number, number, number]>();
    overdueRows.forEach((row) => {
      const values = grouped.get(row.discipline) ?? [0, 0, 0, 0];
      const index = row.liveOverdueDays <= 7 ? 0 : row.liveOverdueDays <= 14 ? 1 : row.liveOverdueDays <= 30 ? 2 : 3;
      values[index] += 1;
      grouped.set(row.discipline, values);
    });
    return Array.from(grouped.entries()).sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).slice(0, 7);
  }, [overdueRows]);

  const disciplineHealth = useMemo(() => {
    const map = new Map<string, LiveDocument[]>();
    filtered.forEach((row) => map.set(row.discipline, [...(map.get(row.discipline) ?? []), row]));
    return Array.from(map.entries()).map(([name, rows]) => {
      const approvedCount = rows.filter((row) => groupStatus(row.lastStatus) === "Approved").length;
      const reviewCount = rows.filter((row) => groupStatus(row.lastStatus) === "Under review").length;
      const overdueCount = rows.filter((row) => row.liveOverdueDays > 0).length;
      const ratio = rows.length ? overdueCount / rows.length : 0;
      return { name, rows: rows.length, approvedCount, reviewCount, overdueCount, health: ratio >= .08 ? "At risk" : ratio >= .03 ? "Attention" : "Good" };
    }).sort((a, b) => b.rows - a.rows).slice(0, 7);
  }, [filtered]);

  const oldestOverdue = overdueRows.reduce((max, row) => Math.max(max, row.liveOverdueDays), 0);
  const overdueDisciplines = new Set(overdueRows.map((row) => row.discipline)).size;
  const enkaDue = filtered.filter((row) => row.liveResponsible === "ENKA" && row.liveDaysUntilDue !== null && row.liveDaysUntilDue <= 7).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function reset() {
    setDraftQuery(""); setQuery(""); setDiscipline("All"); setStatus("All"); setResponsible("All"); setStage("All"); setDueFrom(""); setDueTo(""); setPage(0);
  }

  return (
    <div className="dc-command-center">
      <div className="page-heading dc-page-heading">
        <div><span className="eyebrow">{t("DOCUMENT CONTROL")}</span><h1>{t("Document Control Command Center")}</h1><p>{t("14-day review control, responsibility, overdue aging and direct source-file access.")}</p></div>
      </div>

      <section className="dc-filter-bar" aria-label={t("Document filters")}>
        <form className="dc-search" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery.trim()); setPage(0); }}>
          <span aria-hidden="true">⌕</span><input aria-label={t("Search all document fields")} onChange={(event) => setDraftQuery(event.target.value)} placeholder={t("Search by any document field, date, status or responsibility")} value={draftQuery} /><button type="submit">{t("Search")}</button>
        </form>
        <label><span>{t("Discipline")}</span><select onChange={(event) => { setDiscipline(event.target.value); setPage(0); }} value={discipline}><option value="All">{t("All")}</option>{disciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <label><span>{t("Status")}</span><select onChange={(event) => { setStatus(event.target.value); setPage(0); }} value={status}><option value="All">{t("All")}</option>{statuses.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <label><span>{t("Responsible")}</span><select onChange={(event) => { setResponsible(event.target.value); setPage(0); }} value={responsible}><option value="All">{t("All")}</option>{["Taurus", "ENKA", "Closed", "On Hold", "Unassigned"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <label><span>{t("Review stage")}</span><select onChange={(event) => { setStage(event.target.value); setPage(0); }} value={stage}><option value="All">{t("All")}</option>{["Taurus review", "ENKA incorporation", "Final document", "On hold", "Unassigned"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <div className="dc-date-range"><label><span>{t("Due from")}</span><input onChange={(event) => { setDueFrom(event.target.value); setPage(0); }} type="date" value={dueFrom} /></label><label><span>{t("Due to")}</span><input onChange={(event) => { setDueTo(event.target.value); setPage(0); }} type="date" value={dueTo} /></label></div>
        <div className="dc-filter-actions"><button className="secondary-button" onClick={reset} type="button">↻ {t("Reset")}</button><a className="primary-button" href="/api/export/documents">⇩ {t("Export")}</a></div>
      </section>

      <section className="dc-kpi-grid">
        {[
          ["▤", "Register", total, t("Total documents"), "blue"],
          ["✓", "Approved", approved, total ? `${((approved / total) * 100).toFixed(1)}% ${t("of register")}` : "0%", "green"],
          ["◷", "Under review", underReview, total ? `${((underReview / total) * 100).toFixed(1)}% ${t("of register")}` : "0%", "blue"],
          ["△", "Overdue", overdueRows.length, `${overdueDisciplines} ${t("disciplines")}`, "red"],
          ["▣", "Due next 7 days", dueNextSeven.length, t("Active contractual actions"), "amber"],
          ["↻", "Avg. review cycle", averageCycle ? averageCycle.toFixed(1) : "—", averageCycle ? `${t("days")} · ${t("14-day target")}` : t("No completed cycle"), "green"]
        ].map(([icon, label, value, detail, tone]) => <article className={`dc-kpi dc-tone-${tone}`} key={String(label)}><i>{icon}</i><div><span>{t(String(label))}</span><strong>{typeof value === "number" ? value.toLocaleString(numberLocale) : value}</strong><small>{detail}</small></div></article>)}
      </section>

      <section className="dc-dashboard-row dc-main-row">
        <article className="panel dc-status-panel"><div className="panel-heading"><div><span className="eyebrow">{t("DOCUMENT STATUS")}</span><h2>{t("Register status")}</h2></div></div><DonutChart total={total} translate={t} values={statusValues} /></article>
        <article className="panel dc-review-panel"><div className="panel-heading"><div><span className="eyebrow">{t("REVIEW PERFORMANCE")}</span><h2>{t("Last 12 weeks")}</h2></div><span className="dc-target-badge">14 {t("calendar days")}</span></div><ReviewPerformance locale={numberLocale} rows={filtered} translate={t} /></article>
        <article className="panel dc-priority-panel"><div className="panel-heading"><div><span className="eyebrow">{t("PRIORITY ACTIONS")}</span><h2>{t("Immediate control actions")}</h2></div></div><div className="dc-priority-list">
          <div><b className="red">1</b><p><strong>{overdueRows.length} {t("overdue documents")}</strong><span>{t("Oldest overdue")}: {oldestOverdue} {t("days")} · {overdueDisciplines} {t("disciplines")}</span></p></div>
          <div><b className="amber">2</b><p><strong>{dueNextSeven.length} {t("actions due in 7 days")}</strong><span>{t("Taurus and ENKA contractual clocks")}</span></p></div>
          <div><b className="blue">3</b><p><strong>{enkaDue} {t("ENKA responses due or overdue")}</strong><span>{t("Comment incorporation control")}</span></p></div>
        </div></article>
      </section>

      <section className="dc-dashboard-row dc-health-row">
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">{t("OVERDUE AGING")}</span><h2>{t("Aging by discipline")}</h2></div><div className="dc-aging-legend"><span className="green">1–7</span><span className="amber">8–14</span><span className="orange">15–30</span><span className="red">&gt;30 {t("days")}</span></div></div><div className="dc-aging-chart">
          {disciplineAging.length ? disciplineAging.map(([name, values]) => { const sum = values.reduce((a, b) => a + b, 0); return <div className="dc-aging-row" key={name}><strong>{t(name)}</strong><div>{values.map((value, index) => <span className={`bucket-${index}`} key={index} style={{ flex: value }}>{value || ""}</span>)}</div><b>{sum}</b></div>; }) : <p className="dc-empty-state">{t("No overdue documents in the selected view.")}</p>}
        </div></article>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">{t("DISCIPLINE HEALTH")}</span><h2>{t("Review control by discipline")}</h2></div></div><div className="dc-health-table"><div className="head"><span>{t("Discipline")}</span><span>{t("Health")}</span><span>{t("Approved")}</span><span>{t("Under review")}</span><span>{t("Overdue")}</span></div>{disciplineHealth.map((item) => <div key={item.name}><strong>{t(item.name)}</strong><span className={`health-${item.health.replace(" ", "-").toLowerCase()}`}><i />{t(item.health)}</span><span>{item.approvedCount} ({item.rows ? Math.round(item.approvedCount / item.rows * 100) : 0}%)</span><span>{item.reviewCount}</span><span>{item.overdueCount}</span></div>)}</div></article>
      </section>

      <section className="panel dc-live-register">
        <div className="panel-heading"><div><span className="eyebrow">{t("LIVE REGISTER")}</span><h2>{t("Controlled MDR documents")}</h2></div><span className="dc-live-count">{filtered.length.toLocaleString(numberLocale)} {t("documents")}</span></div>
        <div className="register-scroll"><table className="data-table dc-register-table"><thead><tr><th>{t("Document No.")}</th><th>{t("Title")}</th><th>{t("Discipline")}</th><th>{t("Rev.")}</th><th>{t("Status")}</th><th>{t("Responsible / overdue by")}</th><th>{t("Contractual due date")}</th><th>{t("Aging")}</th><th>{t("File")}</th></tr></thead><tbody>
          {visibleRows.map((row) => <tr key={`${row.documentNo}-${row.sourceRow}`}><td><strong>{row.documentNo}</strong><small>{row.transmittalNo}</small></td><td>{row.title}</td><td>{t(row.discipline)}</td><td>{row.revision || "—"}</td><td><span className={`dc-status-pill status-${groupStatus(row.lastStatus).replaceAll(" ", "-").replace("&", "and").toLowerCase()}`}>{t(row.lastStatus)}</span></td><td><strong className={row.liveOverdueDays ? "dc-overdue-party" : ""}>{t(row.liveResponsible)}</strong><small>{t(reviewStage(row))}</small></td><td>{dateLabel(row.liveDueDate, numberLocale)}<small>{row.liveResponsible === "Taurus" ? t("ENKA submission + 14 days") : row.liveResponsible === "ENKA" ? t("Taurus response + 14 days") : ""}</small></td><td>{row.liveOverdueDays ? <span className="dc-aging-overdue">{row.liveOverdueDays} {t("days overdue")}</span> : row.liveDaysUntilDue !== null && row.liveDaysUntilDue >= 0 ? <span className="dc-aging-due">{row.liveDaysUntilDue} {t("days remaining")}</span> : "—"}</td><td>{row.driveWebUrl ? <a href={row.driveWebUrl} rel="noreferrer" target="_blank">{t("Open")}</a> : "—"}</td></tr>)}
          {!visibleRows.length ? <tr><td className="empty-table-cell" colSpan={9}>{t("No documents match these filters.")}</td></tr> : null}
        </tbody></table></div>
        <div className="table-pagination"><span>{t("Showing")} {filtered.length ? safePage * PAGE_SIZE + 1 : 0}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} {t("of")} {filtered.length.toLocaleString(numberLocale)} · {t("Contract clocks current to")} {dateLabel(today, numberLocale)}{mdrDataDate ? ` · ${t("MDR data date")} ${dateLabel(mdrDataDate, numberLocale)}` : ""}</span><div><button className="secondary-button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>{t("Previous")}</button><span className="dc-page-number">{safePage + 1} / {pageCount}</span><button className="secondary-button" disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>{t("Next")}</button></div></div>
      </section>
    </div>
  );
}

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

type KpiKey = "register" | "approved" | "approved-comments" | "under-review" | "overdue" | "due-next-7" | "on-hold" | "avg-cycle";

type VisualFilter =
  | { kind: "status"; value: string; label: string }
  | { kind: "discipline"; value: string; label: string }
  | { kind: "aging"; discipline: string; bucket: number; label: string }
  | { kind: "overdue"; label: string }
  | { kind: "due-next-7"; label: string }
  | { kind: "enka-due"; label: string }
  | { kind: "week"; start: number; finish: number; label: string };

type KpiDefinition = {
  key: KpiKey;
  icon: string;
  label: string;
  value: number | string;
  detail: string;
  tone: string;
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

function DonutChart({
  values,
  total,
  translate,
  onSelect
}: {
  values: Array<{ label: string; value: number; color: string }>;
  total: number;
  translate: (value: string) => string;
  onSelect: (label: string) => void;
}) {
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
      <button className="dc-donut dc-chart-button" onClick={() => onSelect("Approved")} style={{ background: `conic-gradient(${stops || "#d9e2ec 0deg 360deg"})` }} type="button">
        <div><strong>{approvedPercent.toFixed(1)}%</strong><span>{translate("Approved")}</span></div>
      </button>
      <div className="dc-donut-legend">
        {values.map((item) => (
          <button className="dc-legend-button" key={item.label} onClick={() => onSelect(item.label)} type="button">
            <i style={{ background: item.color }} /><span>{translate(item.label)}</span><strong>{item.value.toLocaleString()}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewPerformance({
  rows,
  locale,
  translate,
  onSelectWeek
}: {
  rows: LiveDocument[];
  locale: string;
  translate: (value: string) => string;
  onSelectWeek: (start: number, finish: number, label: string) => void;
}) {
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
        {weeks.map((week, index) => {
          const x = left + index * step;
          const submittedY = top + plotHeight - (week.submitted / max) * plotHeight;
          const reviewedY = top + plotHeight - (week.reviewed / max) * plotHeight;
          return <g key={`values-${week.start}`} pointerEvents="none">
            <circle className="dc-point-submitted" cx={x} cy={submittedY} r="3.5" />
            <circle className="dc-point-reviewed" cx={x} cy={reviewedY} r="3.5" />
            {week.submitted > 0 ? <text className="dc-value-label dc-value-submitted" textAnchor="middle" x={x} y={Math.max(12, submittedY - 9)}>{week.submitted}</text> : null}
            {week.reviewed > 0 ? <text className="dc-value-label dc-value-reviewed" textAnchor="middle" x={x} y={Math.min(height - 48, reviewedY + 15)}>{week.reviewed}</text> : null}
          </g>;
        })}
        {weeks.map((week, index) => {
          const label = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(week.start);
          return <g className="dc-week-hit" key={`label-${week.start}`} onClick={() => onSelectWeek(week.start, week.start + 7 * DAY, label)}>
            <rect fill="transparent" height={plotHeight + 34} width={Math.max(24, step * .86)} x={left + index * step - Math.max(24, step * .86) / 2} y={top - 5}><title>{translate("Click to filter week")} {label}</title></rect>
            <text className="dc-axis-text" textAnchor="middle" x={left + index * step} y={height - 18}>{label}</text>
          </g>;
        })}
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
  const [selectedKpi, setSelectedKpi] = useState<KpiKey | null>(null);
  const [drilldownPage, setDrilldownPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [visualFilter, setVisualFilter] = useState<VisualFilter | null>(null);
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
  const baseFiltered = useMemo(() => liveDocuments.filter((row) => {
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

  const filtered = useMemo(() => {
    if (!visualFilter) return baseFiltered;
    if (visualFilter.kind === "status") return baseFiltered.filter((row) => groupStatus(row.lastStatus) === visualFilter.value);
    if (visualFilter.kind === "discipline") return baseFiltered.filter((row) => row.discipline === visualFilter.value);
    if (visualFilter.kind === "overdue") return baseFiltered.filter((row) => row.liveOverdueDays > 0);
    if (visualFilter.kind === "due-next-7") return baseFiltered.filter((row) => row.liveDaysUntilDue !== null && row.liveDaysUntilDue >= 0 && row.liveDaysUntilDue <= 7);
    if (visualFilter.kind === "enka-due") return baseFiltered.filter((row) => row.liveResponsible === "ENKA" && row.liveDaysUntilDue !== null && row.liveDaysUntilDue <= 7);
    if (visualFilter.kind === "week") return baseFiltered.filter((row) => {
      const submitted = parseDate(row.lastSubmissionDate);
      const responded = parseDate(row.lastResponseDate);
      return (submitted !== null && submitted >= visualFilter.start && submitted < visualFilter.finish)
        || (responded !== null && responded >= visualFilter.start && responded < visualFilter.finish);
    });
    return baseFiltered.filter((row) => {
      if (row.discipline !== visualFilter.discipline || row.liveOverdueDays <= 0) return false;
      if (visualFilter.bucket === 0) return row.liveOverdueDays <= 7;
      if (visualFilter.bucket === 1) return row.liveOverdueDays >= 8 && row.liveOverdueDays <= 14;
      if (visualFilter.bucket === 2) return row.liveOverdueDays >= 15 && row.liveOverdueDays <= 30;
      return row.liveOverdueDays > 30;
    });
  }, [baseFiltered, visualFilter]);

  const total = filtered.length;
  const approved = filtered.filter((row) => groupStatus(row.lastStatus) === "Approved").length;
  const approvedComments = filtered.filter((row) => groupStatus(row.lastStatus) === "Approved with comments").length;
  const onHoldRows = filtered.filter((row) => row.liveResponsible === "On Hold");
  const underReview = filtered.filter((row) => groupStatus(row.lastStatus) === "Under review").length;
  const overdueRows = filtered.filter((row) => row.liveOverdueDays > 0);
  const dueNextSeven = filtered.filter((row) => row.liveDaysUntilDue !== null && row.liveDaysUntilDue >= 0 && row.liveDaysUntilDue <= 7);
  const cycles = filtered.map(reviewCycle).filter((value): value is number => value !== null && value <= 365);
  const overdueDisciplines = new Set(overdueRows.map((row) => row.discipline)).size;
  const averageCycle = cycles.length ? cycles.reduce((sum, value) => sum + value, 0) / cycles.length : 0;
  const cycleOverTarget = cycles.filter((value) => value > 14).length;
  const cycleOverTargetPercent = cycles.length ? (cycleOverTarget / cycles.length) * 100 : 0;
  const overduePercent = total ? (overdueRows.length / total) * 100 : 0;
  const onHoldPercent = total ? (onHoldRows.length / total) * 100 : 0;

  const kpiDefinitions: KpiDefinition[] = [
    { key: "register", icon: "▤", label: "Register", value: total, detail: t("Total documents"), tone: "blue" },
    { key: "approved", icon: "✓", label: "Approved", value: approved, detail: total ? `${((approved / total) * 100).toFixed(1)}% ${t("of register")}` : "0%", tone: "green" },
    { key: "approved-comments", icon: "✓+", label: "Approved with comments", value: approvedComments, detail: total ? `${((approvedComments / total) * 100).toFixed(1)}% ${t("of register")}` : "0%", tone: "green" },
    { key: "under-review", icon: "◷", label: "Under review", value: underReview, detail: total ? `${((underReview / total) * 100).toFixed(1)}% ${t("of register")}` : "0%", tone: "blue" },
    { key: "overdue", icon: "△", label: "Overdue", value: overdueRows.length, detail: `${overduePercent.toFixed(1)}% ${t("of register")} · ${overdueDisciplines} ${t("disciplines")}`, tone: "red" },
    { key: "due-next-7", icon: "▣", label: "Due next 7 days", value: dueNextSeven.length, detail: t("Active contractual actions"), tone: "amber" },
    { key: "on-hold", icon: "Ⅱ", label: "On hold", value: onHoldRows.length, detail: `${onHoldPercent.toFixed(1)}% ${t("of register")}`, tone: "amber" },
    { key: "avg-cycle", icon: "↻", label: "Avg. review cycle", value: averageCycle ? averageCycle.toFixed(1) : "—", detail: averageCycle ? `${t("days")} · ${t("14-day target")}` : t("No completed cycle"), tone: cycleOverTargetPercent > 0 ? "red" : "green" }
  ];

  const drilldownRows = useMemo(() => {
    if (!selectedKpi) return [];
    if (selectedKpi === "register") return filtered;
    if (selectedKpi === "approved") return filtered.filter((row) => groupStatus(row.lastStatus) === "Approved");
    if (selectedKpi === "approved-comments") return filtered.filter((row) => groupStatus(row.lastStatus) === "Approved with comments");
    if (selectedKpi === "under-review") return filtered.filter((row) => groupStatus(row.lastStatus) === "Under review");
    if (selectedKpi === "overdue") return filtered.filter((row) => row.liveOverdueDays > 0);
    if (selectedKpi === "due-next-7") return filtered.filter((row) => row.liveDaysUntilDue !== null && row.liveDaysUntilDue >= 0 && row.liveDaysUntilDue <= 7);
    if (selectedKpi === "on-hold") return filtered.filter((row) => row.liveResponsible === "On Hold");
    return filtered.filter((row) => { const cycle = reviewCycle(row); return cycle !== null && cycle >= 0 && cycle <= 365; });
  }, [selectedKpi, filtered]);

  const selectedKpiDefinition = selectedKpi ? kpiDefinitions.find((item) => item.key === selectedKpi) ?? null : null;
  const drilldownPageCount = Math.max(1, Math.ceil(drilldownRows.length / PAGE_SIZE));
  const safeDrilldownPage = Math.min(drilldownPage, drilldownPageCount - 1);
  const visibleDrilldownRows = drilldownRows.slice(safeDrilldownPage * PAGE_SIZE, (safeDrilldownPage + 1) * PAGE_SIZE);

  async function exportDrilldown() {
    if (!selectedKpiDefinition || !drilldownRows.length || exporting) return;
    setExporting(true);
    try {
      const response = await fetch("/api/export/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedKpiDefinition.label,
          rows: drilldownRows.map((row) => ({
            documentNo: row.documentNo,
            title: row.title,
            discipline: row.discipline,
            subdiscipline: row.subdiscipline,
            revision: row.revision,
            purpose: row.purpose,
            lastSubmissionDate: row.lastSubmissionDate,
            lastResponseDate: row.lastResponseDate,
            lastStatus: row.lastStatus,
            responsibleParty: row.liveResponsible,
            reviewStage: reviewStage(row),
            dueDate: row.liveDueDate,
            overdueDays: row.liveOverdueDays,
            daysUntilDue: row.liveDaysUntilDue,
            reviewCycleDays: reviewCycle(row),
            transmittalNo: row.transmittalNo,
            transmittalDate: row.transmittalDate,
            driveWebUrl: row.driveWebUrl
          }))
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `taurus-${selectedKpiDefinition.key}.xlsx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

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
  const enkaDue = filtered.filter((row) => row.liveResponsible === "ENKA" && row.liveDaysUntilDue !== null && row.liveDaysUntilDue <= 7).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function reset() {
    setDraftQuery(""); setQuery(""); setDiscipline("All"); setStatus("All"); setResponsible("All"); setStage("All"); setDueFrom(""); setDueTo(""); setVisualFilter(null); setPage(0);
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
        {kpiDefinitions.map((item) => <button aria-label={`${t(item.label)} · ${t("Show document list")}`} className={`dc-kpi dc-kpi-button dc-tone-${item.tone}`} key={item.key} onClick={() => { setSelectedKpi(item.key); setDrilldownPage(0); }} type="button"><i>{item.icon}</i><div><span>{t(item.label)}</span><strong>{typeof item.value === "number" ? item.value.toLocaleString(numberLocale) : item.value}</strong><small>{item.detail}</small><em>{t("Click to view list")} →</em></div></button>)}
      </section>

      <section className="dc-dashboard-row dc-main-row">
        <article className="panel dc-status-panel"><div className="panel-heading"><div><span className="eyebrow">{t("DOCUMENT STATUS")}</span><h2>{t("Register status")}</h2></div></div><DonutChart onSelect={(value) => { setVisualFilter({ kind: "status", value, label: value }); setPage(0); }} total={total} translate={t} values={statusValues} /></article>
        <article className="panel dc-review-panel"><div className="panel-heading"><div><span className="eyebrow">{t("REVIEW PERFORMANCE")}</span><h2>{t("Last 12 weeks")}</h2></div><span className="dc-target-badge">14 {t("calendar days")}</span></div><ReviewPerformance locale={numberLocale} onSelectWeek={(start, finish, label) => { setVisualFilter({ kind: "week", start, finish, label: `${t("Week of")} ${label}` }); setPage(0); }} rows={filtered} translate={t} /></article>
        <article className="panel dc-priority-panel"><div className="panel-heading"><div><span className="eyebrow">{t("PRIORITY ACTIONS")}</span><h2>{t("Immediate control actions")}</h2></div></div><div className="dc-priority-list">
          <button className="dc-priority-action" onClick={() => { setVisualFilter({ kind: "overdue", label: t("Overdue") }); setPage(0); }} type="button"><b className="red">1</b><p><strong>{overdueRows.length} {t("overdue documents")}</strong><span>{t("Oldest overdue")}: {oldestOverdue} {t("days")} · {overdueDisciplines} {t("disciplines")}</span></p></button>
          <button className="dc-priority-action" onClick={() => { setVisualFilter({ kind: "due-next-7", label: t("Due next 7 days") }); setPage(0); }} type="button"><b className="amber">2</b><p><strong>{dueNextSeven.length} {t("actions due in 7 days")}</strong><span>{t("Taurus and ENKA contractual clocks")}</span></p></button>
          <button className="dc-priority-action" onClick={() => { setVisualFilter({ kind: "enka-due", label: t("ENKA responses due or overdue") }); setPage(0); }} type="button"><b className="blue">3</b><p><strong>{enkaDue} {t("ENKA responses due or overdue")}</strong><span>{t("Comment incorporation control")}</span></p></button>
        </div></article>
      </section>

      <section className="dc-dashboard-row dc-health-row">
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">{t("OVERDUE AGING")}</span><h2>{t("Aging by discipline")}</h2></div><div className="dc-aging-legend"><span className="green">1–7</span><span className="amber">8–14</span><span className="orange">15–30</span><span className="red">&gt;30 {t("days")}</span></div></div><div className="dc-aging-chart">
          {disciplineAging.length ? disciplineAging.map(([name, values]) => { const sum = values.reduce((a, b) => a + b, 0); return <div className="dc-aging-row" key={name}><button className="dc-row-filter" onClick={() => { setVisualFilter({ kind: "discipline", value: name, label: name }); setPage(0); }} type="button"><strong>{t(name)}</strong></button><div>{values.map((value, index) => <button aria-label={`${t(name)} · ${index === 0 ? "1–7" : index === 1 ? "8–14" : index === 2 ? "15–30" : ">30"} ${t("days")}`} className={`bucket-${index} dc-aging-bucket`} disabled={!value} key={index} onClick={() => { setVisualFilter({ kind: "aging", discipline: name, bucket: index, label: `${name} · ${index === 0 ? "1–7" : index === 1 ? "8–14" : index === 2 ? "15–30" : ">30"} ${t("days")}` }); setPage(0); }} style={{ flex: value || .0001 }} type="button">{value || ""}</button>)}</div><b>{sum}</b></div>; }) : <p className="dc-empty-state">{t("No overdue documents in the selected view.")}</p>}
        </div></article>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">{t("DISCIPLINE HEALTH")}</span><h2>{t("Review control by discipline")}</h2></div></div><div className="dc-health-table"><div className="head"><span>{t("Discipline")}</span><span>{t("Health")}</span><span>{t("Approved")}</span><span>{t("Under review")}</span><span>{t("Overdue")}</span></div>{disciplineHealth.map((item) => <button className="dc-health-row-button" key={item.name} onClick={() => { setVisualFilter({ kind: "discipline", value: item.name, label: item.name }); setPage(0); }} type="button"><strong>{t(item.name)}</strong><span className={`health-${item.health.replace(" ", "-").toLowerCase()}`}><i />{t(item.health)}</span><span>{item.approvedCount} ({item.rows ? Math.round(item.approvedCount / item.rows * 100) : 0}%)</span><span>{item.reviewCount}</span><span>{item.overdueCount}</span></button>)}</div></article>
      </section>

      {visualFilter ? <div className="dc-active-filter"><span>{t("Interactive chart filter")}:</span><strong>{t(visualFilter.label)}</strong><span>{filtered.length.toLocaleString(numberLocale)} {t("documents")}</span><button onClick={() => { setVisualFilter(null); setPage(0); }} type="button">× {t("Clear")}</button></div> : null}

      <section className="panel dc-live-register">
        <div className="panel-heading"><div><span className="eyebrow">{t("LIVE REGISTER")}</span><h2>{t("Controlled MDR documents")}</h2></div><span className="dc-live-count">{filtered.length.toLocaleString(numberLocale)} {t("documents")}</span></div>
        <div className="register-scroll"><table className="data-table dc-register-table"><thead><tr><th>{t("Document No.")}</th><th>{t("Title")}</th><th>{t("Discipline")}</th><th>{t("Rev.")}</th><th>{t("Status")}</th><th>{t("Responsible / overdue by")}</th><th>{t("Contractual due date")}</th><th>{t("Aging")}</th><th>{t("File")}</th></tr></thead><tbody>
          {visibleRows.map((row) => <tr key={`${row.documentNo}-${row.sourceRow}`}><td><strong>{row.documentNo}</strong><small>{row.transmittalNo}</small></td><td>{row.title}</td><td>{t(row.discipline)}</td><td>{row.revision || "—"}</td><td><span className={`dc-status-pill status-${groupStatus(row.lastStatus).replaceAll(" ", "-").replace("&", "and").toLowerCase()}`}>{t(row.lastStatus)}</span></td><td><strong className={row.liveOverdueDays ? "dc-overdue-party" : ""}>{t(row.liveResponsible)}</strong><small>{t(reviewStage(row))}</small></td><td>{dateLabel(row.liveDueDate, numberLocale)}<small>{row.liveResponsible === "Taurus" ? t("ENKA submission + 14 days") : row.liveResponsible === "ENKA" ? t("Taurus response + 14 days") : ""}</small></td><td>{row.liveOverdueDays ? <span className="dc-aging-overdue">{row.liveOverdueDays} {t("days overdue")}</span> : row.liveDaysUntilDue !== null && row.liveDaysUntilDue >= 0 ? <span className="dc-aging-due">{row.liveDaysUntilDue} {t("days remaining")}</span> : "—"}</td><td>{row.driveWebUrl ? <a href={row.driveWebUrl} rel="noreferrer" target="_blank">{t("Open")}</a> : "—"}</td></tr>)}
          {!visibleRows.length ? <tr><td className="empty-table-cell" colSpan={9}>{t("No documents match these filters.")}</td></tr> : null}
        </tbody></table></div>
        <div className="table-pagination"><span>{t("Showing")} {filtered.length ? safePage * PAGE_SIZE + 1 : 0}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} {t("of")} {filtered.length.toLocaleString(numberLocale)} · {t("Contract clocks current to")} {dateLabel(today, numberLocale)}{mdrDataDate ? ` · ${t("MDR data date")} ${dateLabel(mdrDataDate, numberLocale)}` : ""}</span><div><button className="secondary-button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>{t("Previous")}</button><span className="dc-page-number">{safePage + 1} / {pageCount}</span><button className="secondary-button" disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>{t("Next")}</button></div></div>
      </section>

      {selectedKpiDefinition ? <div aria-modal="true" className="dc-drilldown-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedKpi(null); }} role="dialog">
        <section className="dc-drilldown-modal">
          <div className="dc-drilldown-heading">
            <div><span className="eyebrow">{t("KPI DRILL-DOWN")}</span><h2>{t(selectedKpiDefinition.label)}</h2><p>{drilldownRows.length.toLocaleString(numberLocale)} {t("documents in the current filtered view")}</p></div>
            <div className="dc-drilldown-actions"><button className="primary-button" disabled={!drilldownRows.length || exporting} onClick={exportDrilldown} type="button">⇩ {exporting ? t("Preparing Excel…") : t("Export Excel")}</button><button aria-label={t("Close")} className="dc-modal-close" onClick={() => setSelectedKpi(null)} type="button">×</button></div>
          </div>
          <div className="register-scroll dc-drilldown-scroll"><table className="data-table dc-register-table dc-drilldown-table"><thead><tr><th>{t("Document No.")}</th><th>{t("Title")}</th><th>{t("Discipline")}</th><th>{t("Rev.")}</th><th>{t("Status")}</th><th>{t("Responsible / overdue by")}</th><th>{t("Review stage")}</th><th>{t("Contractual due date")}</th><th>{t("Aging")}</th><th>{t("Review cycle")}</th><th>{t("File")}</th></tr></thead><tbody>
            {visibleDrilldownRows.map((row) => <tr key={`drill-${row.documentNo}-${row.sourceRow}`}><td><strong>{row.documentNo}</strong><small>{row.transmittalNo}</small></td><td>{row.title}</td><td>{t(row.discipline)}</td><td>{row.revision || "—"}</td><td><span className={`dc-status-pill status-${groupStatus(row.lastStatus).replaceAll(" ", "-").replace("&", "and").toLowerCase()}`}>{t(row.lastStatus)}</span></td><td><strong className={row.liveOverdueDays ? "dc-overdue-party" : ""}>{t(row.liveResponsible)}</strong></td><td>{t(reviewStage(row))}</td><td>{dateLabel(row.liveDueDate, numberLocale)}</td><td>{row.liveOverdueDays ? <span className="dc-aging-overdue">{row.liveOverdueDays} {t("days overdue")}</span> : row.liveDaysUntilDue !== null && row.liveDaysUntilDue >= 0 ? <span className="dc-aging-due">{row.liveDaysUntilDue} {t("days remaining")}</span> : "—"}</td><td>{reviewCycle(row) ?? "—"}</td><td>{row.driveWebUrl ? <a href={row.driveWebUrl} rel="noreferrer" target="_blank">{t("Open")}</a> : "—"}</td></tr>)}
            {!visibleDrilldownRows.length ? <tr><td className="empty-table-cell" colSpan={11}>{t("No documents in this KPI for the current filters.")}</td></tr> : null}
          </tbody></table></div>
          <div className="table-pagination dc-drilldown-pagination"><span>{t("Showing")} {drilldownRows.length ? safeDrilldownPage * PAGE_SIZE + 1 : 0}–{Math.min((safeDrilldownPage + 1) * PAGE_SIZE, drilldownRows.length)} {t("of")} {drilldownRows.length.toLocaleString(numberLocale)}</span><div><button className="secondary-button" disabled={safeDrilldownPage === 0} onClick={() => setDrilldownPage(Math.max(0, safeDrilldownPage - 1))}>{t("Previous")}</button><span className="dc-page-number">{safeDrilldownPage + 1} / {drilldownPageCount}</span><button className="secondary-button" disabled={safeDrilldownPage >= drilldownPageCount - 1} onClick={() => setDrilldownPage(Math.min(drilldownPageCount - 1, safeDrilldownPage + 1))}>{t("Next")}</button></div></div>
        </section>
      </div> : null}
    </div>
  );
}

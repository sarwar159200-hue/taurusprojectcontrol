import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { actionDistribution, dashboardMetrics, disciplineDistribution } from "@/lib/demo-data";

export default function DocumentControlPage() {
  const m = dashboardMetrics;
  const approvedPercent = ((m.approved / m.totalDocuments) * 100).toFixed(1);
  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">DOCUMENT CONTROL</span><h1>Controlled document register</h1><p>Review performance, responsibility, aging and direct source-file access.</p></div>
        <button className="secondary-button" type="button">Download register</button>
      </div>
      <section className="kpi-grid five">
        <KpiCard label="Total documents" value={m.totalDocuments.toLocaleString()} detail="Unique document numbers" />
        <KpiCard label="Approved" value={m.approved.toLocaleString()} detail={`${approvedPercent}% of register`} tone="green" />
        <KpiCard label="Approved with comments" value={String(m.approvedWithComments)} detail="B status" tone="amber" />
        <KpiCard label="Under review" value={String(m.underReview)} detail="Taurus action" tone="blue" />
        <KpiCard label="Revise & resubmit" value={String(m.reviseResubmit)} detail="ENKA action" tone="red" />
      </section>
      <section className="dashboard-grid lower-grid">
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">DISTRIBUTION</span><h2>Documents by discipline</h2></div></div><BarList data={disciplineDistribution} limit={9} /></article>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">WORKFLOW</span><h2>Current responsibility</h2></div></div><BarList data={actionDistribution} /></article>
      </section>
      <section className="panel register-panel">
        <div className="panel-heading"><div><span className="eyebrow">LIVE REGISTER</span><h2>List of documents</h2></div><div className="table-search">⌕ Search document number, title or discipline</div></div>
        <div className="empty-table">
          <div>▤</div><strong>Upload the controlled MDR to populate the live register</strong><span>Document links will open the matching OneDrive or SharePoint file after Phase 2 integration.</span>
        </div>
      </section>
    </>
  );
}

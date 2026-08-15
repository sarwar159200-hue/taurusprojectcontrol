import { BarList } from "@/components/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { actionDistribution, dashboardMetrics, disciplineDistribution } from "@/lib/demo-data";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate, metric } from "@/lib/published-data";
import { DocumentRegister } from "@/components/document-register";

export const dynamic = "force-dynamic";

export default async function DocumentControlPage() {
  await requireSection("document_control");
  const update = await getPublishedProjectUpdate();
  const progress = update?.progressAnalysis;
  const m = dashboardMetrics;
  const total = metric(progress?.summary, "documents", m.totalDocuments);
  const approved = metric(progress?.summary, "approved", m.approved);
  const comments = metric(progress?.summary, "approvedWithComments", m.approvedWithComments);
  const review = metric(progress?.summary, "underReview", m.underReview);
  const revise = metric(progress?.summary, "reviseResubmit", m.reviseResubmit);
  const approvedPercent = total ? ((approved / total) * 100).toFixed(1) : "0.0";
  const discipline = progress?.distributions.disciplines ?? {};
  const action = progress?.distributions.actions ?? {};
  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">DOCUMENT CONTROL</span><h1>Controlled document register</h1><p>Review performance, responsibility, aging and direct source-file access.</p></div>
        <button className="secondary-button" type="button">Download register</button>
      </div>
      <section className="kpi-grid five">
        <KpiCard label="Total documents" value={total.toLocaleString()} detail="Unique document numbers" />
        <KpiCard label="Approved" value={approved.toLocaleString()} detail={`${approvedPercent}% of register`} tone="green" />
        <KpiCard label="Approved with comments" value={String(comments)} detail="B status" tone="amber" />
        <KpiCard label="Under review" value={String(review)} detail="Taurus action" tone="blue" />
        <KpiCard label="Revise & resubmit" value={String(revise)} detail="ENKA action" tone="red" />
      </section>
      <section className="dashboard-grid lower-grid">
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">DISTRIBUTION</span><h2>Documents by discipline</h2></div></div><BarList data={Object.keys(discipline).length ? discipline : disciplineDistribution} limit={9} /></article>
        <article className="panel"><div className="panel-heading"><div><span className="eyebrow">WORKFLOW</span><h2>Current responsibility</h2></div></div><BarList data={Object.keys(action).length ? action : actionDistribution} /></article>
      </section>
      <section className="panel register-panel">
        <div className="panel-heading"><div><span className="eyebrow">LIVE REGISTER</span><h2>List of documents</h2></div></div>
        <DocumentRegister documents={progress?.documents ?? []} />
      </section>
    </>
  );
}

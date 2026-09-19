import { requireSection } from "@/lib/auth";
import { canUploadPaymentsByEmail } from "@/lib/roles";
import { createAuthorizedDataClient } from "@/lib/supabase/data";
import { getDefaultProjectId } from "@/lib/project";
import { PROJECT_NAME } from "@/lib/config";

type Supplier = { supplier: string; originalValue: number; variations: number; currentValue: number; paid: number; remaining: number; paymentPercent: number };
type Variation = { voNo: string; supplier: string; description: string; amount: number; currency: string; amountUsd: number | null; status: string; approvedDate: string | null };
type Snapshot = { sourceFile: string; dataDate: string | null; uploadedAt: string; uploadedBy: string; originalValue: number; totalVariations: number; currentValue: number; totalPaid: number; remaining: number; paymentPercent: number; suppliers: Supplier[]; variations: Variation[]; currencyNote: string };

const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toFixed(1)}%`;
const short = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : fmt(v);
async function loadPaymentSnapshot() {
  const projectId = getDefaultProjectId(); if (!projectId) return null;
  const db = await createAuthorizedDataClient();
  const { data } = await db.from("payment_dashboard_snapshots").select("snapshot").eq("project_id", projectId).maybeSingle();
  return (data?.snapshot ?? null) as Snapshot | null;
}
function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className={`payment-kpi ${tone}`}><div className="payment-kpi-icon">{tone === "orange" ? "▣" : tone === "green" ? "↗" : "▤"}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}
export default async function PaymentsPage() {
  const user = await requireSection("payments");
  const canUpload = canUploadPaymentsByEmail(user.email) && user.permissions.payments === "manage";
  let snapshot: Snapshot | null = null; try { snapshot = await loadPaymentSnapshot(); } catch { snapshot = null; }
  const noData = "—";
  return <div className="payment-page">
    <div className="payment-title-row"><div><h1>Project Payments</h1><p>{PROJECT_NAME}</p></div><div className="payment-actions">{snapshot ? <a className="payment-export" href="/api/payments">▣ Export to Excel</a> : null}{canUpload ? <form action="/api/payments" className="payment-upload" encType="multipart/form-data" method="post"><label>↑ Upload / Update Payment Excel<input accept=".xlsx" name="file" required type="file" /></label><button type="submit">Analyze & Publish</button></form> : null}</div></div>
    <div className="payment-meta"><span>Data Date</span><strong>{snapshot?.dataDate ?? "Not published"}</strong>{snapshot ? <><span>Source</span><strong title={snapshot.sourceFile}>{snapshot.sourceFile}</strong></> : null}</div>
    <div className="payment-kpi-grid">
      <Kpi label="Original Contract Value" value={snapshot ? `$ ${fmt(snapshot.originalValue)}` : noData} detail={snapshot ? "100% (Original)" : "Awaiting payment workbook"} tone="blue" />
      <Kpi label="Total Variation Orders" value={snapshot ? `$ ${fmt(snapshot.totalVariations)}` : noData} detail={snapshot && snapshot.originalValue ? `${pct(snapshot.totalVariations / snapshot.originalValue * 100)} of Original` : "Awaiting payment workbook"} tone="orange" />
      <Kpi label="Current Contract Value (Original + Variations)" value={snapshot ? `$ ${fmt(snapshot.currentValue)}` : noData} detail={snapshot && snapshot.originalValue ? `${pct(snapshot.currentValue / snapshot.originalValue * 100)} of Original` : "Awaiting payment workbook"} tone="green" />
      <Kpi label="Total Paid Amount" value={snapshot ? `$ ${fmt(snapshot.totalPaid)}` : noData} detail={snapshot ? `${pct(snapshot.paymentPercent)} of Current Value` : "Awaiting payment workbook"} tone="blue" />
      <Kpi label="Remaining Amount" value={snapshot ? `$ ${fmt(snapshot.remaining)}` : noData} detail={snapshot ? `${pct(100 - snapshot.paymentPercent)} of Current Value` : "Awaiting payment workbook"} tone="red" />
    </div>
    {!snapshot ? <section className="panel payment-empty"><div>▤</div><h2>No payment data published</h2><p>{canUpload ? "Upload the controlled Bazian II payment Excel workbook above. Taurus will analyze it automatically and publish the payment dashboard." : "Payment data will appear here after an authorized payment controller publishes the controlled Excel workbook."}</p></section> : <>
      <div className="payment-main-grid"><section className="panel payment-table-panel"><h2>Supplier Payment Summary</h2><p>Original value, variation orders, current contract value and payments by supplier</p><div className="responsive-table"><table className="payment-table"><thead><tr><th>Supplier</th><th>Original Contract Value (USD Eq.)</th><th>Variation Orders</th><th>Current Contract Value</th><th>Total Paid Amount</th><th>Remaining Amount</th><th>Payment %</th></tr></thead><tbody>{snapshot.suppliers.map((s) => <tr key={s.supplier}><td><b>{s.supplier}</b></td><td>$ {fmt(s.originalValue)}</td><td>$ {fmt(s.variations)}</td><td><b>$ {fmt(s.currentValue)}</b></td><td>$ {fmt(s.paid)}</td><td>$ {fmt(s.remaining)}</td><td><div className="pay-progress"><span>{pct(s.paymentPercent)}</span><i><em style={{ width: `${Math.min(100, s.paymentPercent)}%` }} /></i></div></td></tr>)}<tr className="payment-total"><td>Total (shown suppliers)</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.originalValue,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.variations,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.currentValue,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.paid,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.remaining,0))}</td><td>—</td></tr></tbody></table></div></section>
      <section className="panel payment-status"><h2>Payment Status <small>(Current Contract Value)</small></h2><div className="donut" style={{ background: `conic-gradient(#12a36f 0 ${Math.min(100,snapshot.paymentPercent)}%, #dce5ee ${Math.min(100,snapshot.paymentPercent)}% 100%)` }}><div><strong>{pct(snapshot.paymentPercent)}</strong><span>Paid</span></div></div><div className="payment-legend"><p><i className="paid-dot"/>Paid Amount <b>$ {fmt(snapshot.totalPaid)}</b></p><p><i/>Remaining Amount <b>$ {fmt(snapshot.remaining)}</b></p><hr/><p>Total Contract Value <b>$ {fmt(snapshot.currentValue)}</b></p></div></section></div>
      <div className="payment-chart-grid"><section className="panel"><h2>Contract Value by Supplier</h2><div className="bar-chart">{snapshot.suppliers.map(s=><div key={s.supplier}><span>{short(s.currentValue)}</span><i style={{height:`${Math.max(8,s.currentValue/Math.max(...snapshot.suppliers.map(x=>x.currentValue))*105)}px`}}/><b>{s.supplier}</b></div>)}</div></section><section className="panel"><h2>Paid vs Remaining by Supplier</h2><div className="pair-chart">{snapshot.suppliers.map(s=><div key={s.supplier}><div><i className="paid-bar" style={{height:`${Math.max(6,s.paid/Math.max(...snapshot.suppliers.map(x=>x.currentValue))*100)}px`}}/><i className="remain-bar" style={{height:`${Math.max(6,s.remaining/Math.max(...snapshot.suppliers.map(x=>x.currentValue))*100)}px`}}/></div><b>{s.supplier}</b></div>)}</div></section><section className="panel"><h2>Variation Orders by Supplier</h2><div className="bar-chart orange-bars">{snapshot.suppliers.map(s=><div key={s.supplier}><span>{short(Math.abs(s.variations))}</span><i style={{height:`${Math.max(8,Math.abs(s.variations)/Math.max(1,...snapshot.suppliers.map(x=>Math.abs(x.variations)))*105)}px`}}/><b>{s.supplier}</b></div>)}</div></section></div>
      <section className="panel payment-vo"><div className="panel-heading"><div><h2>Variation Orders Details</h2><p>Approved variation entries extracted from the payment workbook</p></div></div><div className="responsive-table"><table className="payment-table"><thead><tr><th>VO No.</th><th>Supplier</th><th>Description</th><th>Amount</th><th>Currency</th><th>USD Equivalent</th><th>Status</th><th>Approved Date</th></tr></thead><tbody>{snapshot.variations.length ? snapshot.variations.map(v=><tr key={v.voNo}><td>{v.voNo}</td><td>{v.supplier}</td><td>{v.description}</td><td>{fmt(v.amount)}</td><td>{v.currency}</td><td>{v.amountUsd == null ? "—" : `$ ${fmt(v.amountUsd)}`}</td><td><span className="vo-approved">{v.status}</span></td><td>{v.approvedDate ?? "—"}</td></tr>) : <tr><td colSpan={8}>No approved variation entries were detected.</td></tr>}</tbody></table></div><p className="payment-note">{snapshot.currencyNote}</p></section>
    </>}
  </div>;
}

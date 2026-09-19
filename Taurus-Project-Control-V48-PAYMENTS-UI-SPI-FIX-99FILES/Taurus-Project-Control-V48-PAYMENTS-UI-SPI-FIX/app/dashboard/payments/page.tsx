import { requireSection } from "@/lib/auth";
import { canUploadPaymentsByEmail } from "@/lib/roles";
import { createAuthorizedDataClient } from "@/lib/supabase/data";
import { getDefaultProjectId } from "@/lib/project";
import { PROJECT_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

type Supplier = { supplier: string; originalValue: number; variations: number; currentValue: number; paid: number; remaining: number; paymentPercent: number };
type Variation = { voNo: string; supplier: string; description: string; amount: number; currency: string; amountUsd: number | null; status: string; approvedDate: string | null };
type Snapshot = { projectTotals?: { USD: number; EUR: number; PLN: number }; sourceFile: string; dataDate: string | null; uploadedAt: string; uploadedBy: string; originalValue: number; totalVariations: number; currentValue: number; totalPaid: number; remaining: number; paymentPercent: number; suppliers: Supplier[]; variations: Variation[]; currencyNote: string };

const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toFixed(1)}%`;
const short = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : fmt(v);
async function loadPaymentSnapshot() {
  const projectId = getDefaultProjectId(); if (!projectId) return null;
  const db = await createAuthorizedDataClient();
  const { data, error } = await db.from("payment_dashboard_snapshots").select("snapshot").eq("project_id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.snapshot ?? null) as Snapshot | null;
}
function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className={`payment-kpi ${tone}`}><div className="payment-kpi-icon">{tone === "orange" ? "▣" : tone === "green" ? "↗" : "▤"}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}
function SupplierLogo({ name }: { name: string }) {
  if (name === "GE") return <span className="supplier-logo supplier-logo-ge" aria-label="GE"><b>GE</b></span>;
  if (name === "SPG") return <span className="supplier-logo supplier-logo-spg" aria-label="SPG"><i/><b>SPG</b></span>;
  if (name === "JC") return <span className="supplier-logo supplier-logo-jc" aria-label="JC"><b>JC</b></span>;
  return <span className="supplier-logo supplier-logo-gsu" aria-label="GSU"><b>GSU</b></span>;
}

export default async function PaymentsPage({ searchParams }: { searchParams?: Promise<{ uploaded?: string; paymentError?: string; supplier?: string }> }) {
  const user = await requireSection("payments");
  const canUpload = canUploadPaymentsByEmail(user.email) && user.permissions.payments === "manage";
  const params = searchParams ? await searchParams : {};
  let snapshot: Snapshot | null = null;
  let loadError = "";
  try { snapshot = await loadPaymentSnapshot(); } catch (error) { loadError = error instanceof Error ? error.message : "Payment storage is not available."; }
  const errorMessage = params.paymentError || loadError;
  const supplierFilter = params.supplier && ["SPG", "GE", "JC", "GSU"].includes(params.supplier) ? params.supplier : "All";
  const filteredVariations = snapshot ? snapshot.variations.filter((v) => supplierFilter === "All" || v.supplier === supplierFilter) : [];
  const projectTotals = snapshot?.projectTotals ?? { USD: 0, EUR: 0, PLN: 0 };
  const noData = "—";
  const maxCurrent = snapshot ? Math.max(1, ...snapshot.suppliers.map(x => x.currentValue)) : 1;
  const maxVariation = snapshot ? Math.max(1, ...snapshot.suppliers.map(x => Math.abs(x.variations))) : 1;
  return <div className="payment-page payment-reference-layout">
    <div className="payment-title-row"><div><h1>Project Payments</h1><p>{PROJECT_NAME}</p></div><div className="payment-actions">{snapshot ? <a className="payment-export" href="/api/payments">▣ Export to Excel</a> : null}{canUpload ? <form action="/api/payments" className="payment-upload" encType="multipart/form-data" method="post"><label>↑ Upload / Update Payment Excel<input accept=".xlsx" name="file" required type="file" /></label><button type="submit">Analyze & Publish</button></form> : null}</div></div>
    {errorMessage ? <div className="payment-error"><b>Payment workbook was not published.</b><span>{errorMessage}</span>{/payment_dashboard_snapshots|relation .* does not exist/i.test(errorMessage) ? <small>Run the V45 Payment Supabase SQL once, then upload the workbook again.</small> : null}</div> : null}
    {params.uploaded === "1" && snapshot ? <div className="payment-success"><b>Payment workbook analyzed and published successfully.</b><span>{snapshot.sourceFile}</span></div> : null}
    <div className="payment-meta"><span>Data Date</span><strong>{snapshot?.dataDate ?? "Not published"}</strong>{snapshot ? <><span>Source</span><strong title={snapshot.sourceFile}>{snapshot.sourceFile}</strong></> : null}</div>
    {snapshot ? <section className="project-contract-total" aria-label="Overall project contract totals"><div><span>Overall Project Contract Total</span><small>Controlled Price Breakdown totals — currencies shown separately</small></div><strong><em>USD</em>$ {fmt(projectTotals.USD)}</strong><strong><em>EUR</em>€ {fmt(projectTotals.EUR)}</strong><strong><em>PLN</em>{fmt(projectTotals.PLN)} PLN</strong></section> : null}
    <div className="payment-kpi-grid">
      <Kpi label="Original Contract Value" value={snapshot ? `$ ${fmt(snapshot.originalValue)}` : noData} detail={snapshot ? "100% (Original)" : "Awaiting payment workbook"} tone="blue" />
      <Kpi label="Total Variation Orders" value={snapshot ? `$ ${fmt(snapshot.totalVariations)}` : noData} detail={snapshot && snapshot.originalValue ? `${pct(snapshot.totalVariations / snapshot.originalValue * 100)} of Original` : "Awaiting payment workbook"} tone="orange" />
      <Kpi label="Current Contract Value (Original + Variations)" value={snapshot ? `$ ${fmt(snapshot.currentValue)}` : noData} detail={snapshot && snapshot.originalValue ? `${pct(snapshot.currentValue / snapshot.originalValue * 100)} of Original` : "Awaiting payment workbook"} tone="green" />
      <Kpi label="Total Paid Amount" value={snapshot ? `$ ${fmt(snapshot.totalPaid)}` : noData} detail={snapshot ? `${pct(snapshot.paymentPercent)} of Current Value` : "Awaiting payment workbook"} tone="blue" />
      <Kpi label="Remaining Amount" value={snapshot ? `$ ${fmt(snapshot.remaining)}` : noData} detail={snapshot ? `${pct(100 - snapshot.paymentPercent)} of Current Value` : "Awaiting payment workbook"} tone="red" />
    </div>
    {!snapshot ? <section className="panel payment-empty"><div>▤</div><h2>No payment data published</h2><p>{canUpload ? "Upload the controlled Bazian II payment Excel workbook above, then click Analyze & Publish. Taurus will analyze it once and save the compact dashboard result for fast viewing." : "Payment data will appear here after an authorized payment controller publishes the controlled Excel workbook."}</p></section> : <>
      <div className="payment-main-grid"><section className="panel payment-table-panel"><h2>Supplier Payment Summary</h2><p>Original value, variation orders, current contract value and payments by supplier</p><div className="responsive-table"><table className="payment-table"><thead><tr><th>Supplier</th><th>Original Contract Value (USD Eq.)</th><th>Variation Orders</th><th>Current Contract Value</th><th>Total Paid Amount</th><th>Remaining Amount</th><th>Payment %</th></tr></thead><tbody>{snapshot.suppliers.map((s) => <tr key={s.supplier}><td><div className="supplier-cell"><SupplierLogo name={s.supplier}/><b>{s.supplier}</b></div></td><td>$ {fmt(s.originalValue)}</td><td>$ {fmt(s.variations)}</td><td><b>$ {fmt(s.currentValue)}</b></td><td>$ {fmt(s.paid)}</td><td>$ {fmt(s.remaining)}</td><td><div className="pay-progress"><span>{pct(s.paymentPercent)}</span><i><em style={{ width: `${Math.min(100, s.paymentPercent)}%` }} /></i></div></td></tr>)}<tr className="payment-total"><td>Total</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.originalValue,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.variations,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.currentValue,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.paid,0))}</td><td>$ {fmt(snapshot.suppliers.reduce((a,s)=>a+s.remaining,0))}</td><td>{pct(snapshot.paymentPercent)}</td></tr></tbody></table></div></section>
      <section className="panel payment-status"><h2>Payment Status <small>(Current Contract Value)</small></h2><div className="donut" style={{ background: `conic-gradient(#12a36f 0 ${Math.min(100,snapshot.paymentPercent)}%, #dce5ee ${Math.min(100,snapshot.paymentPercent)}% 100%)` }}><div><strong>{pct(snapshot.paymentPercent)}</strong><span>Paid</span></div></div><div className="payment-legend"><p><i className="paid-dot"/>Paid Amount <b>$ {fmt(snapshot.totalPaid)}</b></p><p><i/>Remaining Amount <b>$ {fmt(snapshot.remaining)}</b></p><hr/><p>Total Contract Value <b>$ {fmt(snapshot.currentValue)}</b></p></div></section></div>
      <div className="payment-chart-grid"><section className="panel"><h2>Contract Value by Supplier</h2><div className="bar-chart">{snapshot.suppliers.map(s=><div key={s.supplier} title={`${s.supplier}: $ ${fmt(s.currentValue)}`}><span>$ {short(s.currentValue)}</span><i style={{height:`${Math.max(8,s.currentValue/maxCurrent*105)}px`}}/><b>{s.supplier}</b></div>)}</div><div className="chart-key"><span className="key-blue"/>Current Contract Value</div></section><section className="panel"><h2>Paid vs Remaining by Supplier</h2><div className="pair-chart">{snapshot.suppliers.map(s=><div key={s.supplier}><div><span className="chart-bar-item" title={`Paid: $ ${fmt(s.paid)}`}><em>$ {short(s.paid)}</em><i className="paid-bar" style={{height:`${Math.max(6,s.paid/maxCurrent*100)}px`}}/></span><span className="chart-bar-item" title={`Remaining: $ ${fmt(s.remaining)}`}><em>$ {short(s.remaining)}</em><i className="remain-bar" style={{height:`${Math.max(6,s.remaining/maxCurrent*100)}px`}}/></span></div><b>{s.supplier}</b></div>)}</div><div className="chart-key"><span className="key-green"/>Paid Amount <span className="key-gray"/>Remaining Amount</div></section><section className="panel"><h2>Variation Orders by Supplier</h2><div className="bar-chart orange-bars">{snapshot.suppliers.map(s=><div key={s.supplier}><span>$ {short(Math.abs(s.variations))}</span><i style={{height:`${Math.max(8,Math.abs(s.variations)/maxVariation*105)}px`}}/><b>{s.supplier}</b></div>)}</div></section></div>
      <section className="panel payment-vo"><div className="panel-heading payment-vo-heading"><div><h2>Variation Orders Details</h2><p>Approved variation entries extracted directly from the payment workbook</p></div><div className="vo-filter-row"><a className={supplierFilter === "All" ? "active" : ""} href="/dashboard/payments">All</a>{snapshot.suppliers.map(s=><a className={supplierFilter === s.supplier ? "active" : ""} href={`/dashboard/payments?supplier=${s.supplier}`} key={s.supplier}>{s.supplier}</a>)}</div></div><div className="responsive-table"><table className="payment-table"><thead><tr><th>VO No.</th><th>Supplier</th><th>Description</th><th>Amount</th><th>Currency</th><th>USD Equivalent</th><th>Status</th><th>Approved Date</th></tr></thead><tbody>{filteredVariations.length ? filteredVariations.map(v=><tr key={v.voNo}><td>{v.voNo}</td><td>{v.supplier}</td><td>{v.description}</td><td>{fmt(v.amount)}</td><td>{v.currency}</td><td>{v.amountUsd == null ? "—" : `$ ${fmt(v.amountUsd)}`}</td><td><span className="vo-approved">{v.status}</span></td><td>{v.approvedDate ?? "—"}</td></tr>) : <tr><td colSpan={8}>No approved variation entries were detected.</td></tr>}</tbody></table></div><p className="payment-note">{snapshot.currencyNote}</p></section>
    </>}
  </div>;
}

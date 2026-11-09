import Link from "next/link";
import { FilePlus2, History, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";
import { PurchaseOrderRegisterFilters } from "@/components/vendor-dashboard-filter";
import { purgeDeletedPurchaseOrder, restorePurchaseOrder, softDeletePurchaseOrder } from "../_actions/commercial";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ warning?: string; deleted?: string; restored?: string; purged?: string; error?: string; view?: string; history?: string; po?: string; vendor?: string; sort?: string; dir?: string }> }) {
  const params = await searchParams;
  const historyMode = params.view === "history";
  const supabase = await createClient();
  if (!supabase) return null;
  const { data:{user} } = await supabase.auth.getUser();
  const {data:me}=user?await supabase.from("profiles").select("is_super_admin").eq("id",user.id).maybeSingle():{data:null as any};
  const isSuperAdmin=Boolean(user?.email?.toLowerCase()==="sarwar.khalid@miranenergy.com");

  const poQuery = supabase.from("purchase_orders")
    .select("id,po_number,po_date,original_value,current_value,status,is_historical,is_deleted,deleted_at,deleted_by,delete_reason,vendor_id,currency_id,project_id")
    .eq("is_deleted", historyMode)
    .order(historyMode ? "deleted_at" : "po_date", { ascending: false, nullsFirst: false });
  const { data: posData } = await poQuery;
  const pos = posData ?? [];

  const vendorIds=[...new Set(pos.map((p:any)=>p.vendor_id).filter(Boolean))],currencyIds=[...new Set(pos.map((p:any)=>p.currency_id).filter(Boolean))],projectIds=[...new Set(pos.map((p:any)=>p.project_id).filter(Boolean))],deletedByIds=[...new Set(pos.map((p:any)=>p.deleted_by).filter(Boolean))];
  const poIds=pos.map((p:any)=>String(p.id));
  const [vr,cr,pr,dr,docResult]=await Promise.all([
    vendorIds.length?supabase.from("vendors").select("id,vendor_name").in("id",vendorIds):Promise.resolve({data:[]} as any),
    currencyIds.length?supabase.from("currencies").select("id,code").in("id",currencyIds):Promise.resolve({data:[]} as any),
    projectIds.length?supabase.from("projects").select("id,project_code,project_name").in("id",projectIds):Promise.resolve({data:[]} as any),
    deletedByIds.length?supabase.from("profiles").select("id,full_name,preferred_name,email").in("id",deletedByIds):Promise.resolve({data:[]} as any),
    poIds.length?supabase.from("documents").select("id,purchase_order_id,document_category,document_type,file_name,uploaded_at").in("purchase_order_id",poIds).eq("is_deleted",false).order("uploaded_at",{ascending:false}):Promise.resolve({data:[]} as any),
  ]);
  const vendors=new Map<string,string>((vr.data??[]).map((x:any)=>[String(x.id),String(x.vendor_name??"—")]));
  const currencies=new Map<string,string>((cr.data??[]).map((x:any)=>[String(x.id),String(x.code??"")]));
  const projects=new Map<string,string>((pr.data??[]).map((x:any)=>[String(x.id),String(x.project_name||x.project_code||"—")]));
  const projectCodes=new Map<string,string>((pr.data??[]).map((x:any)=>[String(x.id),String(x.project_code||"")]));
  const selectedPoFilter=String(params.po||"");
  const selectedVendorFilter=String(params.vendor||"");
  let filteredPos=pos.filter((po:any)=>
    (!selectedPoFilter || String(po.id)===selectedPoFilter) &&
    (!selectedVendorFilter || String(po.vendor_id)===selectedVendorFilter)
  );
  const sort=String(params.sort||"po_date"),dir=params.dir==="asc"?"asc":"desc",mul=dir==="desc"?-1:1;
  const poVal=(po:any,k:string)=>({po_number:po.po_number||"",project:projects.get(String(po.project_id))||"",vendor:vendors.get(String(po.vendor_id))||"",po_date:po.po_date||"",value:Number(po.current_value||0),status:po.status||""} as any)[k]??"";
  filteredPos=[...filteredPos].sort((a:any,b:any)=>{const av=poVal(a,sort),bv=poVal(b,sort);return(typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv)))*mul});
  const sortHref=(k:string)=>{const q=new URLSearchParams();if(historyMode)q.set("view","history");if(selectedPoFilter)q.set("po",selectedPoFilter);if(selectedVendorFilter)q.set("vendor",selectedVendorFilter);q.set("sort",k);q.set("dir",sort===k&&dir==="asc"?"desc":"asc");return `/purchase-orders?${q}`};
  const SH=({k,children}:{k:string;children:React.ReactNode})=><th className="px-5 py-3"><Link href={sortHref(k)} className="inline-flex items-center gap-1 hover:text-blue-700">{children}<span>{sort===k?(dir==="asc"?"↑":"↓"):"↕"}</span></Link></th>;
  const poFilterOptions=pos.map((po:any)=>({
    id:String(po.id),
    poNumber:String(po.po_number||"—"),
    packageName:projects.get(String(po.project_id))||projectCodes.get(String(po.project_id))||"—",
  })).sort((a:any,b:any)=>a.poNumber.localeCompare(b.poNumber));
  const vendorFilterOptions=[...new Map(pos.map((po:any)=>[
    String(po.vendor_id||""),
    {id:String(po.vendor_id||""),name:vendors.get(String(po.vendor_id))||"—"}
  ])).values()].filter((v:any)=>v.id).sort((a:any,b:any)=>a.name.localeCompare(b.name));
  const deleters=new Map<string,string>((dr.data??[]).map((x:any)=>[String(x.id),String(x.preferred_name||x.full_name||x.email||"User")]));
  const poFiles=new Map<string,any>();
  for(const d of (docResult.data??[])){const key=String(d.purchase_order_id||"");if(!key)continue;const cat=String(d.document_category||"").toLowerCase(),typ=String(d.document_type||"").toLowerCase(),name=String(d.file_name||"").toLowerCase();const isActualPO=typ.includes("purchase order pdf")||typ==="purchase order"||name.includes("purchase order")||name.includes("_po_")||name.startsWith("po-")||name.startsWith("po_");if(isActualPO){const existing=poFiles.get(key);if(!existing||String(existing.document_type||"").toLowerCase()!=="purchase order pdf")poFiles.set(key,d);}else if(!poFiles.has(key)&&cat==="po"&&!typ.includes("support")&&!typ.includes("offer"))poFiles.set(key,d);}

  let selectedHistory:any[]=[];
  let selectedPo:any=null;
  if (params.history && isSuperAdmin) {
    selectedPo = pos.find((x:any)=>String(x.id)===String(params.history)) || (await supabase.from("purchase_orders").select("id,po_number").eq("id",params.history).maybeSingle()).data;
    const {data:logs}=await supabase.from("audit_logs")
      .select("id,actor_user_id,entity_type,action,before_data,after_data,created_at")
      .eq("entity_id",params.history)
      .in("entity_type",["purchase_order","purchase_orders","purchase_order_purge"])
      .order("created_at",{ascending:false}).limit(100);
    selectedHistory=logs??[];
  }

  const historyActorIds=[...new Set(selectedHistory.map((x:any)=>x.actor_user_id).filter(Boolean))];
  const historyProfiles=historyActorIds.length?(await supabase.from("profiles").select("id,full_name,preferred_name,email").in("id",historyActorIds)).data??[]:[];
  const historyActors=new Map<string,string>(historyProfiles.map((x:any)=>[String(x.id),String(x.preferred_name||x.full_name||x.email||"User")]));

  return <div className="mx-auto max-w-[1600px]">
    {params.deleted?<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Purchase Order moved to Deleted / History. Audit history has been retained.</div>:null}
    {params.restored?<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Purchase Order restored to the active register.</div>:null}
    {params.purged?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Test Purchase Order permanently purged. A minimal purge audit event was retained.</div>:null}
    {params.error?<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{params.error}</div>:null}
    {params.warning?<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{params.warning}</div>:null}

    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Commercial Commitments</div><h1 className="mt-2 text-3xl font-bold">Purchase Orders</h1><p className="mt-2 text-sm text-slate-500">Active PO register plus Super Admin deleted-record and audit history controls.</p></div>
      <div className="flex gap-2"><a href="/api/export/commercial?type=purchase_orders" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Export Excel</a><Link href="/purchase-orders/new" className="inline-flex items-center gap-2 rounded-xl bg-[#07111f] px-4 py-3 text-sm font-bold text-white"><FilePlus2 className="h-4 w-4"/>New Purchase Order</Link></div>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[
        ["Total POs",pos.length,"All active records"],
        ["In Progress",pos.filter((x:any)=>["active","in_progress","in progress"].includes(String(x.status||"").toLowerCase())).length,"Current commitments"],
        ["Approved / Completed",pos.filter((x:any)=>["approved","completed"].includes(String(x.status||"").toLowerCase())).length,"Completed approvals"],
        ["On Hold",pos.filter((x:any)=>String(x.status||"").toLowerCase().includes("hold")).length,"Requires attention"],
        ["Contract Value",pos.reduce((a:number,x:any)=>a+Number(x.current_value||0),0),"All currencies – nominal"]
      ].map(([label,value,sub]:any,i)=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0b1b2b] to-[#102a40] p-4 text-white shadow-sm"><div className="text-xs font-semibold text-slate-300">{label}</div><div className="mt-2 text-2xl font-extrabold">{i===4?Number(value).toLocaleString(undefined,{maximumFractionDigits:0}):Number(value).toLocaleString()}</div><div className="mt-1 text-[11px] text-slate-400">{sub}</div></div>)}
    </div>

    <div className="mt-5 flex flex-wrap gap-2">
      <Link href="/purchase-orders" className={`rounded-xl px-4 py-2.5 text-sm font-bold ${!historyMode?"bg-blue-700 text-white":"border bg-white text-slate-700"}`}>Active Purchase Orders</Link>
      {isSuperAdmin?<Link href="/purchase-orders?view=history" className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${historyMode?"bg-[#07111f] text-white":"border bg-white text-slate-700"}`}><History className="h-4 w-4"/>Deleted / History</Link>:null}
    </div>

    <div className="mccs-card mt-4 rounded-2xl p-4">
      <PurchaseOrderRegisterFilters
        purchaseOrders={poFilterOptions}
        vendors={vendorFilterOptions as any}
        selectedPo={selectedPoFilter}
        selectedVendor={selectedVendorFilter}
      />
    </div>

    <div className="mccs-card mt-5 overflow-hidden rounded-2xl"><div className="mccs-sticky-table-shell"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><SH k="po_number">PO Number</SH><SH k="project">Project</SH><SH k="vendor">Vendor</SH><SH k="po_date">PO Date</SH><SH k="value">Original / Revised PO Value</SH><SH k="status">Status</SH>{!historyMode?<th className="px-5 py-3">PO File</th>:null}{historyMode?<><th className="px-5 py-3">Deleted</th><th className="px-5 py-3">Reason</th></>:<th className="px-5 py-3">History</th>}<th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
      {filteredPos.map((po:any)=><tr key={po.id}><td className="px-5 py-4 font-bold"><Link href={`/purchase-orders/${po.id}`} className="text-blue-700 hover:underline">{po.po_number}</Link></td><td className="px-5 py-4"><div className="font-semibold">{projects.get(String(po.project_id))||"—"}</div>{projectCodes.get(String(po.project_id))&&projectCodes.get(String(po.project_id))!==projects.get(String(po.project_id))?<div className="mt-1 text-xs text-slate-500">{projectCodes.get(String(po.project_id))}</div>:null}</td><td className="px-5 py-4">{vendors.get(String(po.vendor_id))||"—"}</td><td className="px-5 py-4">{po.po_date}</td><td className="px-5 py-4"><div className="font-semibold">Original: {currencies.get(String(po.currency_id))||""} {Number(po.original_value||0).toLocaleString()}</div><div className="mt-1 font-extrabold text-blue-700">Revised: {currencies.get(String(po.currency_id))||""} {Number(po.current_value??po.original_value??0).toLocaleString()}</div></td><td className="px-5 py-4 capitalize">{po.status}</td>
        {!historyMode?<td className="px-5 py-4">{poFiles.get(String(po.id))?<a href={`/api/documents/${poFiles.get(String(po.id)).id}/file`} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline">View PO</a>:<span className="text-slate-400">—</span>}</td>:null}
        {historyMode?<><td className="px-5 py-4"><div className="font-semibold">{fmtDate(po.deleted_at)}</div><div className="mt-1 text-xs text-slate-500">by {deleters.get(String(po.deleted_by))||"System"}</div></td><td className="max-w-[260px] px-5 py-4 text-slate-600">{po.delete_reason||"—"}</td></>:<td className="px-5 py-4"><Link href={`/purchase-orders?history=${po.id}`} className="font-bold text-blue-700">View History</Link></td>}
        <td className="px-5 py-4"><div className="flex flex-wrap items-center gap-3">
          {!historyMode?<><Link href={`/purchase-orders/${po.id}`} className="font-bold text-blue-700">Open</Link>{isSuperAdmin?<Link href={`/purchase-orders/${po.id}/edit`} className="font-bold text-emerald-700">Edit PO & Milestones</Link>:null}{isSuperAdmin?<SuperAdminDelete entity="purchase_order" entityId={po.id} entityLabel={po.po_number} idField="po_id" action={softDeletePurchaseOrder}/>:null}</>:null}
          {historyMode&&isSuperAdmin?<><form action={restorePurchaseOrder}><input type="hidden" name="po_id" value={po.id}/><button className="inline-flex items-center gap-1 font-bold text-emerald-700"><RotateCcw className="h-4 w-4"/>Restore</button></form><Link href={`/purchase-orders?view=history&history=${po.id}`} className="font-bold text-blue-700">Audit Log</Link><SuperAdminDelete mode="purge" entity="purchase_order" entityId={po.id} entityLabel={po.po_number} idField="po_id" action={purgeDeletedPurchaseOrder} className="inline-flex items-center gap-1 font-bold text-red-700"/></>:null}
        </div></td></tr>)}
      {!filteredPos.length?<tr><td colSpan={historyMode?9:9} className="px-5 py-12 text-center text-slate-500">{historyMode?"No deleted Purchase Orders are retained in history.":"No purchase orders yet."}</td></tr>:null}
    </tbody></table></div></div>

    {params.history&&isSuperAdmin?<section className="mccs-card mt-6 overflow-hidden rounded-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-lg font-bold">PO Audit History — {selectedPo?.po_number||"Selected PO"}</h2><p className="mt-1 text-sm text-slate-500">Who created, changed, deleted, restored or purged this Purchase Order.</p></div><Link href={historyMode?"/purchase-orders?view=history":"/purchase-orders"} className="font-bold text-blue-700">Close</Link></div><div className="mccs-sticky-table-shell"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date / Time</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Entity</th><th className="px-5 py-3">Details</th></tr></thead><tbody className="divide-y">{selectedHistory.map((x:any)=><tr key={x.id}><td className="px-5 py-4">{fmtDate(x.created_at)}</td><td className="px-5 py-4 font-semibold">{historyActors.get(String(x.actor_user_id))||"System"}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{x.action}</span></td><td className="px-5 py-4">{x.entity_type}</td><td className="max-w-[420px] px-5 py-4 text-xs text-slate-600">{JSON.stringify(x.after_data||x.before_data||{}).slice(0,420)}</td></tr>)}{!selectedHistory.length?<tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No audit events were found for this PO.</td></tr>:null}</tbody></table></div></section>:null}
  </div>;
}

import {canManageCommercial} from "@/lib/mccs/auth";
import Link from "next/link";
import { deactivateProject, deleteProjectPackage } from "../_actions/commercial";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDelete from "@/components/super-admin-delete";
import { VendorDashboardFilter } from "@/components/vendor-dashboard-filter";

export const dynamic = "force-dynamic";

function projectDuration(start?: string | null, finish?: string | null) {
  if (!start || !finish) return null;
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${finish}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  const weeks = days / 7;
  const months = days / 30.4375;
  return { days, weeks, months };
}

function poBasedDuration(poDate?: string | null, finish?: string | null) {
  if (!poDate || !finish) return null;
  const a = new Date(`${poDate}T00:00:00Z`);
  const b = new Date(`${finish}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  return { days, weeks: days / 7, months: days / 30.4375 };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; package?: string; sort?: string; dir?: string; error?: string; warning?: string; created?: string; updated?: string; deactivated?: string }>;
}) {
  const params = await searchParams;
  const selectedVendor = String(params.vendor || "");
  const selectedPackage = String(params.package || "").trim();
  const supabase = await createClient(); const canManage=await canManageCommercial(supabase);
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle() : {data:null as any};
  const isSuperAdmin = Boolean(user?.email?.toLowerCase() === "sarwar.khalid@miranenergy.com");

  const result = await supabase
    .from("projects")
    .select("id,project_code,project_name,description,start_date,planned_finish_date,is_active,is_deleted,vendor_id,vendors(vendor_name)")
    .eq("is_deleted", false)
    .order("project_name");

  const allRows = result.data ?? [];
  const supplierCounts = new Map<string, number>();
  const supplierNames = new Map<string, string>();
  for (const row of allRows as any[]) {
    const id = String(row.vendor_id || "");
    if (!id) continue;
    supplierCounts.set(id, (supplierCounts.get(id) || 0) + 1);
    supplierNames.set(id, String(row.vendors?.vendor_name || "Unnamed Supplier / Contractor"));
  }
  const supplierOptions = [...supplierNames.entries()]
    .map(([id, name]) => ({ id, name: `${name} (${supplierCounts.get(id) || 0})` }))
    .sort((a, b) => a.name.localeCompare(b.name));
  let rows = selectedVendor ? allRows.filter((r: any) => String(r.vendor_id || "") === selectedVendor) : allRows;
  if(selectedPackage)rows=rows.filter((r:any)=>String(r.project_name||"").toLowerCase().includes(selectedPackage.toLowerCase())||String(r.project_code||"").toLowerCase().includes(selectedPackage.toLowerCase()));
  const sort=String(params.sort||"project_name"),dir=params.dir==="desc"?"desc":"asc",mul=dir==="desc"?-1:1;
  const pval=(r:any,k:string)=>({code:r.project_code||"",project_name:r.project_name||"",vendor:r.vendors?.vendor_name||"",start:r.start_date||"",finish:r.planned_finish_date||"",status:r.is_active?1:0} as any)[k]??"";
  rows=[...rows].sort((a:any,b:any)=>String(pval(a,sort)).localeCompare(String(pval(b,sort)))*mul);
  const sortHref=(k:string)=>{const q=new URLSearchParams();if(selectedVendor)q.set("vendor",selectedVendor);if(selectedPackage)q.set("package",selectedPackage);q.set("sort",k);q.set("dir",sort===k&&dir==="asc"?"desc":"asc");return `/projects?${q}`};
  const SH=({k,children}:{k:string;children:React.ReactNode})=><th className="px-5 py-3"><Link href={sortHref(k)} className="inline-flex items-center gap-1 hover:text-blue-700">{children}<span>{sort===k?(dir==="asc"?"↑":"↓"):"↕"}</span></Link></th>;
  const selectedSupplierLabel = selectedVendor ? (supplierNames.get(selectedVendor) || "Selected Supplier / Contractor") : "All Suppliers & Contractors";
  const projectIds = rows.map((r: any) => r.id).filter(Boolean);
  const poResult = projectIds.length
    ? await supabase
        .from("purchase_orders")
        .select("id,project_id,po_number,po_date,initial_po_date,revised_po_date,is_deleted,status")
        .in("project_id", projectIds)
        .eq("is_deleted", false)
        .order("po_date", { ascending: true })
    : { data: [], error: null } as any;

  const primaryPoByProject = new Map<string, any>();
  for (const po of poResult.data ?? []) {
    const projectId = String((po as any).project_id || "");
    if (!projectId || primaryPoByProject.has(projectId)) continue;
    primaryPoByProject.set(projectId, po);
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">
            Commercial Master Data
          </div>
          <h1 className="mt-2 text-3xl font-bold">Projects & Supply Packages</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create the commercial package under a Vendor / Contractor before creating POs, invoices and documents.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <VendorDashboardFilter vendors={supplierOptions} selectedVendor={selectedVendor} />
          <form action="/projects" method="get" className="flex flex-col gap-1">
            <label htmlFor="package-name-filter" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Package Name / Code</label>
            {selectedVendor?<input type="hidden" name="vendor" value={selectedVendor}/>:null}
            <div className="flex gap-2"><input id="package-name-filter" name="package" type="search" defaultValue={selectedPackage} placeholder="Search package name or code" className="input min-w-[220px]"/><button type="submit" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">Filter</button></div>
          </form>
          <a href="/api/export/commercial?type=projects" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700">Export Excel</a>
          <Link
            href="/projects/new"
            className="rounded-xl bg-[#07111f] px-4 py-3 text-center text-sm font-bold text-white"
          >
            Add Project / Package
          </Link>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-blue-50 px-3 py-1.5 font-bold text-blue-700">{selectedSupplierLabel}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{rows.length} package{rows.length === 1 ? "" : "s"}</span>
        {(selectedVendor||selectedPackage) ? <Link href="/projects" className="rounded-full border px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700">Clear filters</Link> : null}
      </div>

      {params.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {params.error}
        </div>
      ) : null}

      {params.warning ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Project / package was saved, but Google Drive reported: {params.warning}
        </div>
      ) : null}

      {params.created || params.updated || params.deactivated ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {params.created ? "Project / supply package created successfully." : params.updated ? "Project / supply package updated successfully." : "Project / supply package deactivated."}
        </div>
      ) : null}

      {result.error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Projects could not be loaded: {result.error.message}
        </div>
      ) : null}

      <div className="mccs-card mt-7 overflow-hidden rounded-2xl">
        <div className="mccs-sticky-table-shell">
        <table className="min-w-[1450px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <SH k="code">Code</SH>
              <SH k="project_name">Project / Package</SH>
              <SH k="vendor">Vendor / Contractor</SH>
              <SH k="start">Start</SH>
              <SH k="finish">Planned Finish</SH>
              <th className="px-5 py-3">Calendar Duration</th>
              <th className="px-5 py-3">PO Issue Date</th>
              <th className="px-5 py-3">PO-Based Duration</th>
              <SH k="status">Status</SH>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-5 py-4 font-bold">{r.project_code}</td>
                <td className="px-5 py-4">{r.project_name}</td>
                <td className="px-5 py-4">{r.vendors?.vendor_name || "—"}</td>
                <td className="px-5 py-4">{r.start_date || "—"}</td>
                <td className="px-5 py-4">
                  <div>{r.planned_finish_date || "—"}</div>
                  {r.planned_finish_date ? <div className="mt-1 text-[11px] text-slate-400">Basis: planned finish date</div> : null}
                </td>
                <td className="px-5 py-4">
                  {(() => {
                    const d = projectDuration(r.start_date, r.planned_finish_date);
                    return d ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800">{d.days.toLocaleString()} days</div>
                        <div className="text-xs text-slate-500">{d.weeks.toFixed(1)} weeks • {d.months.toFixed(1)} months</div>
                      </div>
                    ) : <span className="text-slate-400">—</span>;
                  })()}
                </td>
                <td className="px-5 py-4">
                  {(() => {
                    const po = primaryPoByProject.get(String(r.id));
                    const poIssueDate = po?.initial_po_date || po?.po_date || null;
                    return poIssueDate ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800">{poIssueDate}</div>
                        <div className="text-[11px] text-slate-400">PO: {po.po_number}</div>
                      </div>
                    ) : <span className="text-slate-400">No linked PO</span>;
                  })()}
                </td>
                <td className="px-5 py-4">
                  {(() => {
                    const po = primaryPoByProject.get(String(r.id));
                    const poIssueDate = po?.initial_po_date || po?.po_date || null;
                    const d = poBasedDuration(poIssueDate, r.planned_finish_date);
                    if (!poIssueDate) return <span className="text-slate-400">—</span>;
                    if (!d) return <span className="text-xs text-slate-400">Planned finish required</span>;
                    return (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800">{d.weeks.toFixed(1)} weeks</div>
                        <div className="text-xs font-medium text-blue-700">from PO issue date</div>
                        <div className="text-[11px] text-slate-500">{d.days.toLocaleString()} days • {d.months.toFixed(1)} months</div>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-5 py-4">
                  {r.is_active ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Inactive</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex flex-wrap justify-end gap-3">{canManage?<Link href={`/projects/${r.id}/edit`} className="text-sm font-bold text-blue-700">Edit</Link>:null}{r.is_active ? <form action={deactivateProject}><input type="hidden" name="project_id" value={r.id}/><button className="text-sm font-bold text-amber-700">Deactivate</button></form>:null}{isSuperAdmin?<SuperAdminDelete entity="project" entityId={r.id} entityLabel={r.project_name} idField="project_id" action={deleteProjectPackage}/>:null}</div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={10} className="px-5 py-12 text-center text-slate-500">
                  No projects / supply packages yet. Create one to unlock the PO and document workflow.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/mccs/auth";

export async function GET(request: Request) {
  const { supabase } = await requireUser();
  const url = new URL(request.url);
  if (url.searchParams.get("type") === "vdrl") {
    const search = (url.searchParams.get("q")||"").replace(/[,%()]/g," ").trim();
    const docs:any[]=[];
    for(let from=0;;from+=1000){
      let q:any = supabase.from("vdrl_documents").select("document_number,document_title,supplier_id,contractor_id,project_id,package_id,discipline,sub_discipline,document_type,current_stage,current_revision,planned_submit_date,actual_submit_date,planned_return_date,actual_return_date,resubmission_due_date,return_code,current_status,submission_variance,return_variance,days_overdue,responsible_party").eq("is_active",true).order("document_number");
      for (const [param,col] of [["supplier","supplier_id"],["contractor","contractor_id"],["project","project_id"],["package","package_id"],["stage","current_stage"],["status","current_status"],["code","return_code"],["discipline","discipline"],["sub_discipline","sub_discipline"],["document_type","document_type"],["revision","current_revision"],["responsible","responsible_party"]] as const) { const v=url.searchParams.get(param); if(v) q=q.eq(col,v); }
      const df=url.searchParams.get("date_from"),dt=url.searchParams.get("date_to"); if(df)q=q.gte("planned_submit_date",df); if(dt)q=q.lte("planned_submit_date",dt);
      if(search) q=q.or(`document_number.ilike.%${search}%,document_title.ilike.%${search}%,discipline.ilike.%${search}%`);
      const {data,error}=await q.range(from,from+999); if(error)throw new Error(error.message); const rows=data??[]; docs.push(...rows); if(rows.length<1000)break;
    }
    const [{data:vendors},{data:projects}] = await Promise.all([supabase.from("vendors").select("id,vendor_name"),supabase.from("projects").select("id,project_name,project_code")]);
    const vm=new Map((vendors??[]).map((x:any)=>[String(x.id),x.vendor_name])); const pm=new Map((projects??[]).map((x:any)=>[String(x.id),x.project_name||x.project_code]));
    const wb=new ExcelJS.Workbook(); wb.creator="MCCS"; wb.created=new Date(); const ws=wb.addWorksheet("VDRL Register");
    ws.columns=[
      ["Document Number","document_number",28],["Document Title","document_title",42],["Supplier","supplier",28],["Contractor","contractor",28],["Project / Package","package",30],["Discipline","discipline",18],["Sub-Discipline","sub_discipline",18],["Document Type","document_type",20],["Stage","current_stage",12],["Revision","current_revision",12],["Planned Submit","planned_submit_date",16],["Actual Submit","actual_submit_date",16],["Planned Return","planned_return_date",16],["Actual Return","actual_return_date",16],["Return Code","return_code",14],["Status","current_status",22],["Submission Variance","submission_variance",18],["Return Variance","return_variance",18],["Days Overdue","days_overdue",14],["Responsible Party","responsible_party",18]
    ].map((x:any)=>({header:x[0],key:x[1],width:x[2]}));
    (docs??[]).forEach((d:any)=>ws.addRow({...d,supplier:vm.get(String(d.supplier_id))||"",contractor:vm.get(String(d.contractor_id))||"",package:pm.get(String(d.package_id||d.project_id))||""}));
    ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}}; ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF07111F"}}; ws.views=[{state:"frozen",ySplit:1}]; ws.autoFilter={from:{row:1,column:1},to:{row:1,column:ws.columnCount}};
    const buffer=await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as BodyInit,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="MCCS-VDRL-Export-${new Date().toISOString().slice(0,10)}.xlsx"`}});
  }
  const requestedType = String(url.searchParams.get("type") || "all").toLowerCase();
  if (requestedType === "dashboard_milestones") {
    const scope=String(url.searchParams.get("scope")||"overdue");
    const vendorFilter=String(url.searchParams.get("vendor")||"");
    const today=new Date(); const todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const week=new Date(today.getFullYear(),today.getMonth(),today.getDate()+7); const weekKey=`${week.getFullYear()}-${String(week.getMonth()+1).padStart(2,"0")}-${String(week.getDate()).padStart(2,"0")}`;
    const three=new Date(today.getFullYear(),today.getMonth()+3,today.getDate()); const threeKey=`${three.getFullYear()}-${String(three.getMonth()+1).padStart(2,"0")}-${String(three.getDate()).padStart(2,"0")}`;
    const month=todayKey.slice(0,7);
    const [{data:milestones,error:me},{data:pos},{data:vendors},{data:projects},{data:currencies},{data:payments}] = await Promise.all([
      supabase.from("payment_milestones").select("id,purchase_order_id,milestone_name,percentage,fixed_amount,payment_due_date,actual_payment_date,status").eq("is_deleted",false),
      supabase.from("purchase_orders").select("id,po_number,vendor_id,project_id,currency_id,current_value").eq("is_deleted",false),
      supabase.from("vendors").select("id,vendor_name"), supabase.from("projects").select("id,project_name,project_code"), supabase.from("currencies").select("id,code"),
      supabase.from("payments").select("payment_milestone_id,paid_amount").eq("is_deleted",false)
    ]);
    if(me) return NextResponse.json({error:me.message},{status:500});
    const pm=new Map((pos??[]).map((x:any)=>[String(x.id),x])),vm=new Map((vendors??[]).map((x:any)=>[String(x.id),x.vendor_name])),prm=new Map((projects??[]).map((x:any)=>[String(x.id),x.project_name||x.project_code])),cm=new Map((currencies??[]).map((x:any)=>[String(x.id),x.code]));
    const paid=new Map<string,number>(); for(const x of payments??[]) paid.set(String(x.payment_milestone_id),Number(paid.get(String(x.payment_milestone_id))||0)+Number(x.paid_amount||0));
    let rows=(milestones??[]).map((m:any)=>{const po:any=pm.get(String(m.purchase_order_id));const due=String(m.payment_due_date||"").slice(0,10);const full=m.fixed_amount!=null?Number(m.fixed_amount):Number(po?.current_value||0)*Number(m.percentage||0)/100;const overdue=due&&due<todayKey?Math.floor((new Date(todayKey+'T00:00:00').getTime()-new Date(due+'T00:00:00').getTime())/86400000):0;return {...m,po,supplier:vm.get(String(po?.vendor_id))||"",package:prm.get(String(po?.project_id))||"",currency:cm.get(String(po?.currency_id))||"",due,overdue,outstanding:Math.max(0,full-Number(paid.get(String(m.id))||0))};}).filter((r:any)=>r.po&&(!vendorFilter||String(r.po.vendor_id)===vendorFilter)&&!r.actual_payment_date&&String(r.status||"").toLowerCase()!=="paid");
    rows=rows.filter((r:any)=>scope==="overdue"?r.due&&r.due<todayKey:scope==="week"?r.due>=todayKey&&r.due<=weekKey:scope==="month"?r.due.startsWith(month):scope==="three-months"?r.due>=todayKey&&r.due<=threeKey:true).sort((a:any,b:any)=>a.due.localeCompare(b.due));
    const wb=new ExcelJS.Workbook();wb.creator="MCCS – Miran Energy Ltd";wb.company="Miran Energy Ltd";wb.created=new Date();const ws=wb.addWorksheet("Milestone Action Register",{views:[{state:"frozen",ySplit:5}]});
    const headers=["PO Number","Supplier / Contractor","Project / Package","Milestone","Milestone %","Payment Due","Overdue Days","Currency","Outstanding Amount","Status","Actual Payment Date"];
    ws.mergeCells(1,1,1,headers.length);ws.getCell(1,1).value="MIRAN ENERGY LTD — PAYMENT MILESTONE ACTION REGISTER";ws.getCell(1,1).font={bold:true,size:18,color:{argb:"FFFFFFFF"}};ws.getCell(1,1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF07111F"}};ws.getRow(1).height=34;
    ws.mergeCells(2,1,2,headers.length);ws.getCell(2,1).value=`MCCS • ${scope.replaceAll("-"," ").toUpperCase()} • Data date ${todayKey} • ${rows.length} milestone(s)`;ws.getCell(2,1).font={bold:true,size:10,color:{argb:"FF475569"}};
    ws.mergeCells(3,1,3,headers.length);ws.getCell(3,1).value="Commercial control working register — filterable, management-ready and confidential.";ws.getCell(3,1).font={italic:true,size:10,color:{argb:"FF64748B"}};
    ws.addRow([]);ws.addRow(headers);const hr=ws.getRow(5);hr.font={bold:true,color:{argb:"FFFFFFFF"}};hr.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0B4EDB"}};hr.alignment={horizontal:"center",vertical:"middle",wrapText:true};hr.height=30;
    [22,30,34,30,13,16,15,12,20,20,18].forEach((w,i)=>ws.getColumn(i+1).width=w);
    for(const r of rows) ws.addRow([r.po.po_number,r.supplier,r.package,r.milestone_name,Number(r.percentage||0),r.due,r.overdue,r.currency,r.outstanding,String(r.status||"planned").replaceAll("_"," "),r.actual_payment_date||""]);
    ws.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,ws.rowCount),column:headers.length}};ws.getColumn(5).numFmt='0.00"%"';ws.getColumn(9).numFmt='#,##0.00;[Red]-#,##0.00';
    for(let i=6;i<=ws.rowCount;i++){const row=ws.getRow(i);row.alignment={vertical:"top",wrapText:true};if(i%2===0)row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF8FAFC"}};if(Number(row.getCell(7).value)>0)row.getCell(7).font={bold:true,color:{argb:"FFDC2626"}};}
    ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};ws.headerFooter.oddFooter="&LMCCS – Miran Energy Ltd&CConfidential&RPage &P of &N";
    const buffer=await wb.xlsx.writeBuffer();return new NextResponse(buffer as BodyInit,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="MCCS-${scope}-Milestones-${todayKey}.xlsx"`,"Cache-Control":"no-store"}});
  }
  if (requestedType === "purchase_orders") {
    const { data: poRows, error: poError } = await supabase.from("purchase_orders")
      .select("id,po_number,pr_number,rfq_number,project_id,vendor_id,currency_id,po_date,approval_date,original_value,approved_variations,current_value,status,delivery_due_date,delivery_terms,payment_terms,quote_ref,quote_date,incoterm,origin_of_goods,warranty,initial_po_date,revised_po_date,is_historical,historical_source,notes")
      .eq("is_deleted", false).order("po_date", { ascending: false, nullsFirst: false });
    if (poError) return NextResponse.json({ error: `Purchase Order export failed: ${poError.message}` }, { status: 500 });
    const rows:any[] = poRows ?? [];
    const vendorIds=[...new Set(rows.map(x=>x.vendor_id).filter(Boolean))];
    const currencyIds=[...new Set(rows.map(x=>x.currency_id).filter(Boolean))];
    const projectIds=[...new Set(rows.map(x=>x.project_id).filter(Boolean))];
    const [vr,cr,pr]=await Promise.all([
      vendorIds.length?supabase.from("vendors").select("id,vendor_code,vendor_name").in("id",vendorIds):Promise.resolve({data:[],error:null} as any),
      currencyIds.length?supabase.from("currencies").select("id,code").in("id",currencyIds):Promise.resolve({data:[],error:null} as any),
      projectIds.length?supabase.from("projects").select("id,project_code,project_name").in("id",projectIds):Promise.resolve({data:[],error:null} as any),
    ]);
    for(const r of [vr,cr,pr]) if(r.error) return NextResponse.json({error:`Purchase Order export lookup failed: ${r.error.message}`},{status:500});
    const vm=new Map((vr.data??[]).map((x:any)=>[String(x.id),x]));
    const cm=new Map((cr.data??[]).map((x:any)=>[String(x.id),String(x.code||"")]));
    const pm=new Map((pr.data??[]).map((x:any)=>[String(x.id),x]));

    const wb=new ExcelJS.Workbook(); wb.creator="MCCS – Miran Energy Ltd"; wb.company="Miran Energy Ltd"; wb.created=new Date();
    const ws=wb.addWorksheet("Purchase Orders",{views:[{state:"frozen",ySplit:4}]});
    const headers=["PO Number","Project / Package","Project Code","Vendor / Contractor","Vendor Code","PO Date","Approval Date","Currency","Original Value","Approved Variations","Current Value","Status","Delivery Due","Incoterm","Delivery Terms","Payment Terms","PR Number","RFQ Number","Quote Ref","Quote Date","Origin of Goods","Warranty","Initial PO Date","Revised PO Date","Historical","Historical Source","Notes"];
    const widths=[22,34,16,32,16,14,14,11,18,19,18,16,15,14,28,30,18,18,20,14,20,22,16,16,12,24,40];
    ws.mergeCells(1,1,1,headers.length); ws.getCell(1,1).value="MIRAN ENERGY LTD — PURCHASE ORDER REGISTER";
    ws.getCell(1,1).font={bold:true,size:18,color:{argb:"FFFFFFFF"}}; ws.getCell(1,1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF07111F"}}; ws.getCell(1,1).alignment={vertical:"middle",horizontal:"left"}; ws.getRow(1).height=34;
    ws.mergeCells(2,1,2,headers.length); ws.getCell(2,1).value=`Miran Commercial Control System (MCCS) • Generated ${new Date().toLocaleString("en-GB",{timeZone:"Asia/Baghdad"})} • ${rows.length} active purchase order(s)`; ws.getCell(2,1).font={italic:true,size:10,color:{argb:"FF475569"}}; ws.getRow(2).height=22;
    ws.addRow([]); ws.addRow(headers);
    const h=ws.getRow(4); h.font={bold:true,color:{argb:"FFFFFFFF"}}; h.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0B4EDB"}}; h.alignment={vertical:"middle",horizontal:"center",wrapText:true}; h.height=32;
    headers.forEach((_,i)=>ws.getColumn(i+1).width=widths[i]);
    for(const r of rows){const v:any=vm.get(String(r.vendor_id))||{}, p:any=pm.get(String(r.project_id))||{}; ws.addRow([
      r.po_number||"",p.project_name||p.project_code||"",p.project_code||"",v.vendor_name||"",v.vendor_code||"",r.po_date||null,r.approval_date||null,cm.get(String(r.currency_id))||"",Number(r.original_value||0),Number(r.approved_variations||0),Number(r.current_value ?? (Number(r.original_value||0)+Number(r.approved_variations||0))),r.status||"",r.delivery_due_date||null,r.incoterm||"",r.delivery_terms||"",r.payment_terms||"",r.pr_number||"",r.rfq_number||"",r.quote_ref||"",r.quote_date||null,r.origin_of_goods||"",r.warranty||"",r.initial_po_date||null,r.revised_po_date||null,r.is_historical?"Yes":"No",r.historical_source||"",r.notes||""
    ]);}
    const last=Math.max(4,ws.rowCount); ws.autoFilter={from:{row:4,column:1},to:{row:last,column:headers.length}};
    for(let r=5;r<=ws.rowCount;r++){const row=ws.getRow(r); row.alignment={vertical:"top",wrapText:true}; if(r%2===1) row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF8FAFC"}};}
    for(const c of [6,7,13,20,23,24]) ws.getColumn(c).numFmt="dd-mmm-yyyy";
    for(const c of [9,10,11]) ws.getColumn(c).numFmt='#,##0.00;[Red]-#,##0.00';
    ws.getColumn(12).alignment={horizontal:"center"}; ws.getColumn(25).alignment={horizontal:"center"};
    ws.eachRow((row,rowNumber)=>{if(rowNumber>=4) row.eachCell(cell=>{cell.border={bottom:{style:"hair",color:{argb:"FFD9E2EC"}}};});});
    ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:0.25,right:0.25,top:0.5,bottom:0.5,header:0.2,footer:0.2}};
    ws.headerFooter.oddFooter="&LMCCS – Miran Energy Ltd&CConfidential&RPage &P of &N";
    const buf=await wb.xlsx.writeBuffer();
    return new NextResponse(buf as BodyInit,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="MCCS-Purchase-Orders-Export-${new Date().toISOString().slice(0,10)}.xlsx"`,"Cache-Control":"no-store"}});
  }

  const [poR,vR,mR,iR,pR,projR] = await Promise.all([
    supabase.from("purchase_orders").select("po_number,po_date,current_value,status,is_historical,vendors(vendor_name),currencies(code)").eq("is_deleted",false).order("po_date"),
    supabase.from("vendors").select("vendor_code,vendor_name,relationship_type,parent_vendor_id,is_active,is_deleted").eq("is_deleted",false).order("vendor_name"),
    supabase.from("payment_milestones").select("milestone_name,percentage,fixed_amount,planned_due_date,payment_due_date,status,is_deleted,purchase_orders(po_number)").eq("is_deleted",false).order("planned_due_date"),
    supabase.from("invoices").select("invoice_number,invoice_date,invoice_amount,certified_amount,status,due_date,is_deleted").eq("is_deleted",false),
    supabase.from("payments").select("payment_date,paid_amount,payment_reference,bank_reference,is_deleted").eq("is_deleted",false),
    supabase.from("projects").select("project_code,project_name,start_date,planned_finish_date,is_active,is_deleted,vendors(vendor_name)").eq("is_deleted",false).order("project_name"),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MCCS";
  workbook.created = new Date();


  const projectsSheet = workbook.addWorksheet("Projects & Packages");
  projectsSheet.columns=[{header:"Code",key:"code",width:18},{header:"Project / Package",key:"name",width:36},{header:"Vendor / Contractor",key:"vendor",width:30},{header:"Start",key:"start",width:15},{header:"Planned Finish",key:"finish",width:16},{header:"Status",key:"status",width:14}];
  (projR.data??[]).forEach((r:any)=>projectsSheet.addRow({code:r.project_code,name:r.project_name,vendor:r.vendors?.vendor_name,start:r.start_date,finish:r.planned_finish_date,status:r.is_active?"Active":"Inactive"}));

  const pos = workbook.addWorksheet("Purchase Orders");
  pos.columns = [
    {header:"PO Number",key:"po_number",width:22},{header:"Vendor",key:"vendor",width:30},{header:"PO Date",key:"po_date",width:15},{header:"Currency",key:"currency",width:12},{header:"Current Value",key:"current_value",width:18},{header:"Status",key:"status",width:16},{header:"Historical",key:"historical",width:12}
  ];
  (poR.data??[]).forEach((r:any)=>pos.addRow({po_number:r.po_number,vendor:r.vendors?.vendor_name,po_date:r.po_date,currency:r.currencies?.code,current_value:Number(r.current_value||0),status:r.status,historical:r.is_historical?"Yes":"No"}));

  const vendors = workbook.addWorksheet("Vendors");
  vendors.columns=[{header:"Code",key:"code",width:15},{header:"Vendor",key:"vendor",width:32},{header:"Relationship",key:"rel",width:20},{header:"Status",key:"status",width:12}];
  (vR.data??[]).forEach((r:any)=>vendors.addRow({code:r.vendor_code,vendor:r.vendor_name,rel:r.relationship_type,status:r.is_active?"Active":"Inactive"}));

  const milestones = workbook.addWorksheet("Payment Milestones");
  milestones.columns=[{header:"PO",key:"po",width:22},{header:"Milestone",key:"name",width:32},{header:"%",key:"pct",width:10},{header:"Amount",key:"amt",width:18},{header:"Planned Due",key:"due",width:15},{header:"Payment Due",key:"pdue",width:15},{header:"Status",key:"status",width:15}];
  (mR.data??[]).forEach((r:any)=>milestones.addRow({po:r.purchase_orders?.po_number,name:r.milestone_name,pct:r.percentage,amt:r.fixed_amount,due:r.planned_due_date,pdue:r.payment_due_date,status:r.status}));

  const invoices = workbook.addWorksheet("Invoices");
  invoices.columns=[{header:"Invoice",key:"invoice",width:22},{header:"Date",key:"date",width:14},{header:"Invoice Amount",key:"amount",width:18},{header:"Certified",key:"certified",width:18},{header:"Due",key:"due",width:14},{header:"Status",key:"status",width:18}];
  (iR.data??[]).forEach((r:any)=>invoices.addRow({invoice:r.invoice_number,date:r.invoice_date,amount:r.invoice_amount,certified:r.certified_amount,due:r.due_date,status:r.status}));

  const payments = workbook.addWorksheet("Payments");
  payments.columns=[{header:"Date",key:"date",width:14},{header:"Paid Amount",key:"amount",width:18},{header:"Payment Ref",key:"ref",width:24},{header:"Bank Ref",key:"bank",width:24}];
  (pR.data??[]).forEach((r:any)=>payments.addRow({date:r.payment_date,amount:r.paid_amount,ref:r.payment_reference,bank:r.bank_reference}));

  const requested = String(url.searchParams.get("type") || "all").toLowerCase();
  const keep: Record<string,string> = { projects: "Projects & Packages", purchase_orders: "Purchase Orders", payment_milestones: "Payment Milestones", invoices: "Invoices" };
  if (keep[requested]) {
    for (const ws of [...workbook.worksheets]) if (ws.name !== keep[requested]) workbook.removeWorksheet(ws.id);
  }

  for (const ws of workbook.worksheets) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: {row:1,column:1}, to:{row:1,column:ws.columnCount} };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="MCCS-${requested === "all" ? "Commercial" : requested.replaceAll("_","-")}-Export-${new Date().toISOString().slice(0,10)}.xlsx"`,
    },
  });
}

"use client";
import { useMemo, useState } from "react";
import type { DocumentRecordInput } from "@/lib/types";

export function DocumentRegister({ documents }: { documents: DocumentRecordInput[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => documents.filter((row) => `${row.documentNo} ${row.title} ${row.discipline} ${row.subdiscipline}`.toLowerCase().includes(query.toLowerCase())), [documents, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 100));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * 100, (safePage + 1) * 100);
  return <>
    <input className="table-search" placeholder="Search document number, title, discipline or sub-discipline" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
    <div className="register-scroll"><table className="data-table"><thead><tr><th>Document No.</th><th>Title</th><th>Discipline</th><th>Rev.</th><th>Status</th><th>Action</th><th>Overdue</th><th>File</th></tr></thead><tbody>
      {rows.map((row) => <tr key={`${row.documentNo}-${row.sourceRow}`}><td>{row.documentNo}</td><td>{row.title}</td><td>{row.discipline}</td><td>{row.revision}</td><td>{row.lastStatus}</td><td>{row.currentAction}</td><td>{row.overdueDays ?? "—"}</td><td>{row.driveWebUrl ? <a href={row.driveWebUrl} target="_blank" rel="noreferrer">Open file</a> : "—"}</td></tr>)}
    </tbody></table></div>
    {documents.length ? <div className="table-pagination"><span>{filtered.length.toLocaleString()} documents · Page {safePage + 1} of {pageCount}</span><div><button className="secondary-button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>Previous</button><button className="secondary-button" disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>Next</button></div></div> : null}
    {!documents.length ? <div className="empty-table"><strong>No published MDR yet</strong><span>Use Import & Publish to upload the progress/MDR workbook.</span></div> : null}
  </>;
}

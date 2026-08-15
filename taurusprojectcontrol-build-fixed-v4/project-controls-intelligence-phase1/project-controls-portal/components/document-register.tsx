"use client";
import { useMemo, useState } from "react";
import type { DocumentRecordInput } from "@/lib/types";

export function DocumentRegister({ documents }: { documents: DocumentRecordInput[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => documents.filter((row) => `${row.documentNo} ${row.title} ${row.discipline}`.toLowerCase().includes(query.toLowerCase())).slice(0, 200), [documents, query]);
  return <>
    <input className="table-search" placeholder="Search document number, title or discipline" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="register-scroll"><table className="data-table"><thead><tr><th>Document No.</th><th>Title</th><th>Discipline</th><th>Rev.</th><th>Status</th><th>Action</th><th>Overdue</th><th>File</th></tr></thead><tbody>
      {rows.map((row) => <tr key={`${row.documentNo}-${row.sourceRow}`}><td>{row.documentNo}</td><td>{row.title}</td><td>{row.discipline}</td><td>{row.revision}</td><td>{row.lastStatus}</td><td>{row.currentAction}</td><td>{row.overdueDays ?? "—"}</td><td>{row.driveWebUrl ? <a href={row.driveWebUrl} target="_blank" rel="noreferrer">Open</a> : "—"}</td></tr>)}
    </tbody></table></div>
    {!documents.length ? <div className="empty-table"><strong>No published MDR yet</strong><span>Use Import & Publish to upload the progress/MDR workbook.</span></div> : null}
  </>;
}

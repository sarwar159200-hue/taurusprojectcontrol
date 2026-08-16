"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import type { WorkbookPreview } from "@/lib/types";

type Result =
  | { name: string; state: "loading" }
  | { name: string; state: "error"; error: string }
  | { name: string; state: "ready"; preview: WorkbookPreview };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadWorkbooks() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

  async function process(files: File[]) {
    const xlsxFiles = files.filter((file) => file.name.toLowerCase().endsWith(".xlsx"));
    if (!xlsxFiles.length) { setMessage("Select an XLSX workbook."); return; }
    if (xlsxFiles.length > 2) { setMessage("Select a maximum of two workbooks: one progress/MDR file and one schedule file."); return; }
    const oversized = xlsxFiles.find((file) => file.size > 8 * 1024 * 1024);
    if (oversized) { setMessage(`${oversized.name} is larger than the 8 MB upload limit.`); return; }
    setMessage("");
    setResults(xlsxFiles.map((file) => ({ name: file.name, state: "loading" })));
    const body = new FormData();
    xlsxFiles.forEach((file) => body.append("files", file));
    try {
      const response = await fetch("/api/import/publish", { method: "POST", body, cache: "no-store" });
      const responseText = await response.text();
      let payload: { previews?: WorkbookPreview[]; error?: string } = {};
      try { payload = JSON.parse(responseText) as typeof payload; }
      catch { payload.error = responseText.trim() || `Server returned HTTP ${response.status}.`; }
      if (!response.ok) {
        const detail = payload.error ?? `Import failed with HTTP ${response.status}.`;
        setResults(xlsxFiles.map((file) => ({ name: file.name, state: "error", error: detail })));
        return;
      }
      setResults((payload.previews ?? []).map((preview) => ({ name: preview.fileName, state: "ready", preview })));
      setMessage("Update analyzed and published successfully. All authorized users will see the new data.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Network or server error.";
      setResults(xlsxFiles.map((file) => ({ name: file.name, state: "error", error: detail })));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    void process(Array.from(event.target.files ?? []));
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void process(Array.from(event.dataTransfer.files));
  }

  return (
    <div>
      <div
        className={`drop-zone ${dragging ? "is-dragging" : ""}`}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
      >
        <div className="upload-icon">⇧</div>
        <h3>Upload the controlled project workbooks</h3>
        <p>Choose the progress/MDR workbook, schedule export, or both. Analysis and publication start automatically.</p>
        <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
          Select Excel files
        </button>
        <input ref={inputRef} hidden multiple type="file" accept=".xlsx" onChange={pick} />
        <small>XLSX only, maximum 8 MB per file. Uploading one file keeps the other published analysis.</small>
      </div>

      {message ? <div className="callout"><strong>Upload status</strong><span>{message}</span></div> : null}

      <div className="import-results">
        {results.map((result) => (
          <article className="import-card" key={result.name}>
            <div className="import-card-heading">
              <div>
                <span className="eyebrow">AUTOMATIC ANALYSIS</span>
                <h3>{result.name}</h3>
              </div>
              <span className={`status-pill status-${result.state}`}>
                {result.state === "loading"
                  ? "Reading"
                  : result.state === "error"
                    ? "Failed"
                    : result.preview.valid
                      ? "Ready"
                      : "Review"}
              </span>
            </div>
            {result.state === "loading" ? <div className="progress-loader"><span /></div> : null}
            {result.state === "error" ? <div className="validation-error">{result.error}</div> : null}
            {result.state === "ready" ? <Preview preview={result.preview} /> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function Preview({ preview }: { preview: WorkbookPreview }) {
  return (
    <div className="preview-content">
      <div className="file-meta">
        <span>{preview.kind === "progress" ? "Progress & MDR" : "Schedule export"}</span>
        <span>{formatBytes(preview.fileSize)}</span>
        <span>{preview.sheets.length} sheet{preview.sheets.length === 1 ? "" : "s"}</span>
      </div>
      <div className="summary-grid compact-summary">
        {Object.entries(preview.summary).map(([key, value]) => (
          <div key={key}>
            <span>{key.replace(/([A-Z])/g, " $1")}</span>
            <strong>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
      {preview.errors.length ? (
        <div className="validation-block validation-errors">
          <strong>Blocking errors</strong>
          <ul>{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}
      {preview.warnings.length ? (
        <div className="validation-block validation-warnings">
          <strong>Review notes</strong>
          <ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      ) : null}
      <div className="publish-row">
        <div>
          <strong>{preview.valid ? "Validation passed" : "Resolve the blocking errors"}</strong>
          <span>The valid workbook has been analyzed and published.</span>
        </div>
        <span className="status-pill status-ready">Live</span>
      </div>
    </div>
  );
}

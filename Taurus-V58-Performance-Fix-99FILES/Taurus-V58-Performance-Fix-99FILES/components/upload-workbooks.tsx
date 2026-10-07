"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import type { WorkbookPreview } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";

type Result =
  | { name: string; state: "loading" }
  | { name: string; state: "error"; error: string }
  | { name: string; state: "ready"; preview: WorkbookPreview };

type PublishedUpdate = { publishedAt: string; dataDate: string | null };
type NotificationResult = { state: "loading" } | { state: "success" | "error"; message: string };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadWorkbooks({ canNotify = false }: { canNotify?: boolean }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [publishedUpdate, setPublishedUpdate] = useState<PublishedUpdate | null>(null);
  const [notification, setNotification] = useState<NotificationResult | null>(null);

  async function process(files: File[]) {
    const xlsxFiles = files.filter((file) => file.name.toLowerCase().endsWith(".xlsx"));
    if (!xlsxFiles.length) { setMessage(t("Select an XLSX workbook.")); return; }
    if (xlsxFiles.length > 2) { setMessage(t("Select a maximum of two workbooks: one progress/MDR file and one schedule file.")); return; }
    const oversized = xlsxFiles.find((file) => file.size > 8 * 1024 * 1024);
    if (oversized) { setMessage(`${oversized.name} is larger than the 8 MB upload limit.`); return; }
    setMessage("");
    setPublishedUpdate(null);
    setNotification(null);
    setResults(xlsxFiles.map((file) => ({ name: file.name, state: "loading" })));
    const body = new FormData();
    xlsxFiles.forEach((file) => body.append("files", file));
    try {
      const response = await fetch("/api/import/publish", { method: "POST", body, cache: "no-store" });
      const responseText = await response.text();
      let payload: { previews?: WorkbookPreview[]; error?: string; publishedAt?: string; dataDate?: string | null } = {};
      try { payload = JSON.parse(responseText) as typeof payload; }
      catch { payload.error = responseText.trim() || `Server returned HTTP ${response.status}.`; }
      if (!response.ok) {
        const detail = payload.error ?? `Import failed with HTTP ${response.status}.`;
        setResults(xlsxFiles.map((file) => ({ name: file.name, state: "error", error: detail })));
        return;
      }
      setResults((payload.previews ?? []).map((preview) => ({ name: preview.fileName, state: "ready", preview })));
      if (payload.publishedAt) setPublishedUpdate({ publishedAt: payload.publishedAt, dataDate: payload.dataDate ?? null });
      setMessage(t("Update analyzed and published successfully. All authorized users will see the new data."));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Network or server error.";
      setResults(xlsxFiles.map((file) => ({ name: file.name, state: "error", error: detail })));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function notifyUsers() {
    if (!publishedUpdate || notification?.state === "loading") return;
    if (!window.confirm(t("Send this update notification to every other active project user?"))) return;
    setNotification({ state: "loading" });
    try {
      const response = await fetch("/api/admin/notifications/project-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedPublishedAt: publishedUpdate.publishedAt }),
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string; sent?: number; failed?: number };
      if (!response.ok) throw new Error(payload.error || t("Email notifications could not be sent."));
      const sent = payload.sent ?? 0;
      const failed = payload.failed ?? 0;
      const localizedMessage = sent === 0
        ? t("There are no other active project users to notify.")
        : failed > 0
          ? `${sent} ${t("notifications sent")}; ${failed} ${t("could not be delivered")}.`
          : `${sent} ${t("project user(s) notified successfully")}.`;
      setNotification({ state: "success", message: localizedMessage });
    } catch (error) {
      setNotification({ state: "error", message: error instanceof Error ? error.message : t("Email notifications could not be sent.") });
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
        <h3>{t("Upload the controlled project workbooks")}</h3>
        <p>{t("Choose the progress/MDR workbook, schedule export, or both. Analysis and publication start automatically.")}</p>
        <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
          {t("Select Excel files")}
        </button>
        <input ref={inputRef} hidden multiple type="file" accept=".xlsx" onChange={pick} />
        <small>{t("XLSX only, maximum 8 MB per file. Uploading one file keeps the other published analysis.")}</small>
      </div>

      {message ? <div className="callout"><strong>{t("Upload status")}</strong><span>{message}</span></div> : null}

      {canNotify && publishedUpdate ? (
        <section className="panel publish-notification-panel">
          <div className="publish-notification-icon">✉</div>
          <div className="publish-notification-copy">
            <span className="eyebrow">{t("CONTROLLED COMMUNICATION")}</span>
            <h3>{t("Notify project users of this update")}</h3>
            <p>{t("Send a formal email to every other active project user with the dashboard link, administrator name and current schedule data date.")}</p>
            <small>{t("Published schedule data date")}: <strong>{publishedUpdate.dataDate ?? t("Not published")}</strong></small>
          </div>
          <div className="publish-notification-action">
            <button className="primary-button notify-users-button" disabled={notification?.state === "loading"} onClick={() => void notifyUsers()} type="button">
              {notification?.state === "loading" ? t("Sending notifications…") : t("Email update notification")}
            </button>
            {notification && notification.state !== "loading" ? (
              <span className={`notification-result ${notification.state}`}>{notification.message}</span>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="import-results">
        {results.map((result) => (
          <article className="import-card" key={result.name}>
            <div className="import-card-heading">
              <div>
                <span className="eyebrow">{t("AUTOMATIC ANALYSIS")}</span>
                <h3>{result.name}</h3>
              </div>
              <span className={`status-pill status-${result.state}`}>
                {result.state === "loading"
                  ? t("Reading")
                  : result.state === "error"
                    ? t("Failed")
                    : result.preview.valid
                      ? t("Ready")
                      : t("Review")}
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
  const { t } = useLanguage();
  return (
    <div className="preview-content">
      <div className="file-meta">
        <span>{preview.kind === "progress" ? t("Progress & MDR") : t("Schedule export")}</span>
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
          <strong>{t("Blocking errors")}</strong>
          <ul>{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}
      {preview.warnings.length ? (
        <div className="validation-block validation-warnings">
          <strong>{t("Review notes")}</strong>
          <ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      ) : null}
      <div className="publish-row">
        <div>
          <strong>{preview.valid ? t("Validation passed") : t("Resolve the blocking errors")}</strong>
          <span>{t("The valid workbook has been analyzed and published.")}</span>
        </div>
        <span className="status-pill status-ready">{t("Live")}</span>
      </div>
    </div>
  );
}

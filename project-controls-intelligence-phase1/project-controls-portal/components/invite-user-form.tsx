"use client";

import { FormEvent, useState } from "react";

export function InviteUserForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        username: form.get("username"),
        fullName: form.get("fullName"),
        role: form.get("role")
      })
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Invitation could not be sent.");
      return;
    }
    event.currentTarget.reset();
    setMessage("Invitation sent successfully.");
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          <span>Full name</span>
          <input name="fullName" placeholder="Employee name" required />
        </label>
        <label>
          <span>Username</span>
          <input name="username" placeholder="firstname.lastname" pattern="[a-zA-Z0-9._-]{3,40}" required />
        </label>
        <label>
          <span>Email address</span>
          <input type="email" name="email" placeholder="name@company.com" required />
        </label>
        <label>
          <span>Role</span>
          <select name="role" defaultValue="viewer">
            <option value="viewer">Viewer</option>
            <option value="planner">Planner</option>
            <option value="document_controller">Document Controller</option>
            <option value="project_admin">Project Administrator</option>
          </select>
        </label>
      </div>
      {message ? <div className="form-message">{message}</div> : null}
      <button className="primary-button" disabled={busy} type="submit">
        {busy ? "Sending invitation…" : "Invite user"}
      </button>
    </form>
  );
}

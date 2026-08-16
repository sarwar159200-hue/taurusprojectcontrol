"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPermissionsForRole, sectionDefinitions } from "@/lib/permissions";
import type { AccessLevel, AppRole, ManagedUser, SectionPermissions } from "@/lib/types";

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "planner", label: "Planner" },
  { value: "document_controller", label: "Document Controller" },
  { value: "project_admin", label: "Project Administrator" },
  { value: "super_admin", label: "Super Administrator" }
];

function generateTemporaryPassword() {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*"];
  const random = (limit: number) => crypto.getRandomValues(new Uint32Array(1))[0] % limit;
  const required = groups.map((group) => group[random(group.length)]);
  const combined = groups.join("");
  const extra = Array.from({ length: 12 }, () => combined[random(combined.length)]);
  return [...required, ...extra]
    .map((character) => ({ character, order: random(1_000_000) }))
    .sort((a, b) => a.order - b.order)
    .map(({ character }) => character)
    .join("");
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Never"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function PermissionEditor({ permissions, disabled, onChange }: {
  permissions: SectionPermissions;
  disabled?: boolean;
  onChange: (next: SectionPermissions) => void;
}) {
  return (
    <div className="permission-grid">
      {sectionDefinitions.map((section) => (
        <label className="permission-control" key={section.key}>
          <span><strong>{section.label}</strong><small>{section.description}</small></span>
          <select
            aria-label={`${section.label} permission`}
            disabled={disabled}
            onChange={(event) => onChange({
              ...permissions,
              [section.key]: event.target.value as AccessLevel
            })}
            value={permissions[section.key]}
          >
            <option value="none">No access</option>
            <option value="view">View</option>
            <option value="manage">Manage</option>
          </select>
        </label>
      ))}
    </div>
  );
}

function CreateUserPanel({ currentUserRole, onCreated }: {
  currentUserRole: AppRole;
  onCreated: () => void;
}) {
  const [role, setRole] = useState<AppRole>("viewer");
  const [permissions, setPermissions] = useState(() => defaultPermissionsForRole("viewer"));
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [issuedPassword, setIssuedPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function changeRole(nextRole: AppRole) {
    setRole(nextRole);
    setPermissions(defaultPermissionsForRole(nextRole));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    setIssuedPassword("");
    const form = new FormData(formElement);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        username: form.get("username"),
        email: form.get("email"),
        role,
        temporaryPassword,
        permissions
      })
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "The account could not be created.");
      return;
    }
    setMessage("Account created successfully. Copy the temporary password below before leaving this page.");
    setIssuedPassword(temporaryPassword);
    formElement.reset();
    setTemporaryPassword("");
    changeRole("viewer");
    onCreated();
  }

  return (
    <section className="panel user-create-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">NEW ACCOUNT</span><h2>Create user with temporary password</h2></div>
        <span className="status-pill status-ready">Forced password change</span>
      </div>
      <form className="admin-form full-width-form" onSubmit={submit}>
        <div className="form-grid three-columns">
          <label><span>Full name</span><input name="fullName" placeholder="Employee name" required /></label>
          <label><span>Username</span><input name="username" pattern="[a-zA-Z0-9._-]{3,40}" placeholder="firstname.lastname" required /></label>
          <label><span>Email address</span><input name="email" placeholder="name@company.com" required type="email" /></label>
          <label>
            <span>Role</span>
            <select onChange={(event) => changeRole(event.target.value as AppRole)} value={role}>
              {roleOptions
                .filter((option) => option.value !== "super_admin" || currentUserRole === "super_admin")
                .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="password-field">
            <span>Temporary password</span>
            <div className="input-action-row">
              <input
                minLength={12}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder="Generate or enter 12+ characters"
                required
                type="text"
                value={temporaryPassword}
              />
              <button className="secondary-button" onClick={() => setTemporaryPassword(generateTemporaryPassword())} type="button">Generate</button>
              <button className="secondary-button" disabled={!temporaryPassword} onClick={() => void navigator.clipboard.writeText(temporaryPassword)} type="button">Copy</button>
            </div>
          </label>
        </div>
        <div className="permission-heading"><strong>Section permissions</strong><span>Choose no access, view, or manage for every part of the portal.</span></div>
        <PermissionEditor disabled={role === "super_admin"} onChange={setPermissions} permissions={permissions} />
        {issuedPassword ? (
          <div className="password-disclosure">
            <span><strong>Temporary password created</strong><small>Share it securely. The user must replace it at first login.</small></span>
            <code>{issuedPassword}</code>
            <button className="secondary-button" onClick={() => void navigator.clipboard.writeText(issuedPassword)} type="button">Copy password</button>
          </div>
        ) : null}
        {message ? <div className="form-message">{message}</div> : null}
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Creating account…" : "Create user account"}</button>
      </form>
    </section>
  );
}

function UserEditor({ canManage, currentUserId, currentUserRole, user, onChanged }: {
  canManage: boolean;
  currentUserId: string;
  currentUserRole: AppRole;
  user: ManagedUser;
  onChanged: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [permissions, setPermissions] = useState(user.permissions);
  const [username, setUsername] = useState(user.username);
  const [fullName, setFullName] = useState(user.fullName);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const protectedUser = user.role === "super_admin" && currentUserRole !== "super_admin";
  const editable = canManage && !protectedUser && user.id !== currentUserId;

  function changeRole(nextRole: AppRole) {
    setRole(nextRole);
    setPermissions(defaultPermissionsForRole(nextRole));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, fullName, role, permissions, temporaryPassword: temporaryPassword || undefined })
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Changes could not be saved.");
      return;
    }
    setTemporaryPassword("");
    setMessage("Changes saved successfully.");
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`Remove portal access for ${user.fullName} (${user.email})? Historical audit records will be preserved.`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "The user could not be removed.");
      return;
    }
    onChanged();
  }

  return (
    <details className="user-card">
      <summary>
        <span className="user-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
        <span className="user-identity"><strong>{user.fullName}</strong><small>{user.email} · @{user.username}</small></span>
        <span className={`status-pill ${user.isActive ? "status-ready" : "status-error"}`}>{user.isActive ? "Active" : "Disabled"}</span>
        <span className="user-role-label">{user.role.replaceAll("_", " ")}</span>
        <span className="user-login"><small>Last login</small><strong>{formatDate(user.lastLoginAt)}</strong></span>
      </summary>
      <div className="user-editor-body">
        <div className="form-grid three-columns admin-form full-width-form">
          <label><span>Full name</span><input disabled={!editable} onChange={(event) => setFullName(event.target.value)} value={fullName} /></label>
          <label><span>Username</span><input disabled={!editable} onChange={(event) => setUsername(event.target.value)} value={username} /></label>
          <label>
            <span>Role</span>
            <select disabled={!editable || user.id === currentUserId} onChange={(event) => changeRole(event.target.value as AppRole)} value={role}>
              {roleOptions
                .filter((option) => option.value !== "super_admin" || currentUserRole === "super_admin")
                .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="permission-heading"><strong>Section permissions</strong><span>{user.mustChangePassword ? "Temporary password change is pending." : "Password is controlled by the user."}</span></div>
        <PermissionEditor disabled={!editable || role === "super_admin"} onChange={setPermissions} permissions={permissions} />
        {editable ? (
          <div className="temporary-reset-row">
            <label><span>Issue a new temporary password (optional)</span><input minLength={12} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="Leave blank to keep current password" type="text" value={temporaryPassword} /></label>
            <button className="secondary-button" onClick={() => setTemporaryPassword(generateTemporaryPassword())} type="button">Generate</button>
            <button className="secondary-button" disabled={!temporaryPassword} onClick={() => void navigator.clipboard.writeText(temporaryPassword)} type="button">Copy</button>
          </div>
        ) : null}
        {message ? <div className="form-message">{message}</div> : null}
        {editable ? (
          <div className="user-action-row">
            <button className="primary-button" disabled={busy} onClick={() => void save()} type="button">{busy ? "Saving…" : "Save permissions"}</button>
            <button className="danger-button" disabled={busy || user.id === currentUserId || user.role === "super_admin"} onClick={() => void remove()} type="button">Remove access</button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function UserManagement({ canManage, currentUserId, currentUserRole, initialUsers }: {
  canManage: boolean;
  currentUserId: string;
  currentUserRole: AppRole;
  initialUsers: ManagedUser[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="user-management-stack">
      {canManage ? <CreateUserPanel currentUserRole={currentUserRole} onCreated={refresh} /> : null}
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">AUTHORIZED USERS</span><h2>{initialUsers.length} account{initialUsers.length === 1 ? "" : "s"}</h2></div>
          {!canManage ? <span className="status-pill status-loading">View only</span> : null}
        </div>
        <div className="user-list">
          {initialUsers.map((user) => (
            <UserEditor
              canManage={canManage}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              key={user.id}
              onChanged={refresh}
              user={user}
            />
          ))}
          {!initialUsers.length ? <div className="empty-user-list">No Supabase users were found.</div> : null}
        </div>
      </section>
    </div>
  );
}

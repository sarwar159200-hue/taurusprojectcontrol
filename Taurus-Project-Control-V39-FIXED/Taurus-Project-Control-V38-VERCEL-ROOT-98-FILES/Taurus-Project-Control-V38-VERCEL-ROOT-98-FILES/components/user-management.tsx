"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPermissionsForRole, sectionDefinitions } from "@/lib/permissions";
import type { AccessLevel, AppRole, ManagedUser, SectionPermissions } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";

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

function formatDate(value: string | null, locale: string, never: string) {
  if (!value) return never;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? never
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function PermissionEditor({ permissions, disabled, onChange }: {
  permissions: SectionPermissions;
  disabled?: boolean;
  onChange: (next: SectionPermissions) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="permission-grid">
      {sectionDefinitions.map((section) => (
        <label className="permission-control" key={section.key}>
          <span><strong>{t(section.label)}</strong><small>{t(section.description)}</small></span>
          <select
            aria-label={`${t(section.label)} ${t("permission")}`}
            disabled={disabled}
            onChange={(event) => onChange({
              ...permissions,
              [section.key]: event.target.value as AccessLevel
            })}
            value={permissions[section.key]}
          >
            <option value="none">{t("No access")}</option>
            <option value="view">{t("View")}</option>
            <option value="manage">{t("Manage")}</option>
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
  const { t } = useLanguage();
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
      setMessage(t(result.error ?? "The account could not be created."));
      return;
    }
    setMessage(t("Account created successfully. Copy the temporary password below before leaving this page."));
    setIssuedPassword(temporaryPassword);
    formElement.reset();
    setTemporaryPassword("");
    changeRole("viewer");
    onCreated();
  }

  return (
    <section className="panel user-create-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">{t("NEW ACCOUNT")}</span><h2>{t("Create user with temporary password")}</h2></div>
        <span className="status-pill status-ready">{t("Forced password change")}</span>
      </div>
      <form className="admin-form full-width-form" onSubmit={submit}>
        <div className="form-grid three-columns">
          <label><span>{t("Full name")}</span><input name="fullName" placeholder={t("Employee name")} required /></label>
          <label><span>{t("Username")}</span><input name="username" pattern="[a-zA-Z0-9._-]{3,40}" placeholder="firstname.lastname" required /></label>
          <label><span>{t("Email address")}</span><input name="email" placeholder="name@company.com" required type="email" /></label>
          <label>
            <span>{t("Role")}</span>
            <select onChange={(event) => changeRole(event.target.value as AppRole)} value={role}>
              {roleOptions
                .filter((option) => option.value !== "super_admin" || currentUserRole === "super_admin")
                .map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
          </label>
          <label className="password-field">
            <span>{t("Temporary password")}</span>
            <div className="input-action-row">
              <input
                minLength={12}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder={t("Generate or enter 12+ characters")}
                required
                type="text"
                value={temporaryPassword}
              />
              <button className="secondary-button" onClick={() => setTemporaryPassword(generateTemporaryPassword())} type="button">{t("Generate")}</button>
              <button className="secondary-button" disabled={!temporaryPassword} onClick={() => void navigator.clipboard.writeText(temporaryPassword)} type="button">{t("Copy")}</button>
            </div>
          </label>
        </div>
        <div className="permission-heading"><strong>{t("Section permissions")}</strong><span>{t("Choose no access, view, or manage for every part of the portal.")}</span></div>
        <PermissionEditor disabled={role === "super_admin"} onChange={setPermissions} permissions={permissions} />
        {issuedPassword ? (
          <div className="password-disclosure">
            <span><strong>{t("Temporary password created")}</strong><small>{t("Share it securely. The user must replace it at first login.")}</small></span>
            <code>{issuedPassword}</code>
            <button className="secondary-button" onClick={() => void navigator.clipboard.writeText(issuedPassword)} type="button">{t("Copy password")}</button>
          </div>
        ) : null}
        {message ? <div className="form-message">{message}</div> : null}
        <button className="primary-button" disabled={busy} type="submit">{busy ? t("Creating account…") : t("Create user account")}</button>
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
  const { locale, t } = useLanguage();
  const dateLocale = locale === "ku" ? "ckb-IQ" : locale === "ar" ? "ar-IQ" : "en-GB";
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
      setMessage(t(result.error ?? "Changes could not be saved."));
      return;
    }
    setTemporaryPassword("");
    setMessage(t("Changes saved successfully."));
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`${t("Remove portal access for")} ${user.fullName} (${user.email})? ${t("Historical audit records will be preserved.")}`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(t(result.error ?? "The user could not be removed."));
      return;
    }
    onChanged();
  }

  return (
    <details className="user-card">
      <summary>
        <span className="user-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
        <span className="user-identity"><strong>{user.fullName}</strong><small>{user.email} · @{user.username}</small></span>
        <span className={`status-pill ${user.isOnline ? "status-ready" : user.isActive ? "status-loading" : "status-error"}`}>{user.isOnline ? t("Online") : user.isActive ? t("Offline") : t("Disabled")}</span>
        <span className="user-role-label">{t(roleOptions.find((option) => option.value === user.role)?.label ?? user.role.replaceAll("_", " "))}</span>
        <span className="user-login"><small>{user.isOnline ? t("Live now") : t("Last seen")}</small><strong>{user.isOnline ? t("Online") : formatDate(user.lastSeenAt ?? user.lastLoginAt, dateLocale, t("Never"))}</strong></span>
      </summary>
      <div className="user-editor-body">
        <div className="form-grid three-columns admin-form full-width-form">
          <label><span>{t("Full name")}</span><input disabled={!editable} onChange={(event) => setFullName(event.target.value)} value={fullName} /></label>
          <label><span>{t("Username")}</span><input disabled={!editable} onChange={(event) => setUsername(event.target.value)} value={username} /></label>
          <label>
            <span>{t("Role")}</span>
            <select disabled={!editable || user.id === currentUserId} onChange={(event) => changeRole(event.target.value as AppRole)} value={role}>
              {roleOptions
                .filter((option) => option.value !== "super_admin" || currentUserRole === "super_admin")
                .map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
          </label>
        </div>
        <div className="permission-heading"><strong>{t("Section permissions")}</strong><span>{user.mustChangePassword ? t("Temporary password change is pending.") : t("Password is controlled by the user.")}</span></div>
        <PermissionEditor disabled={!editable || role === "super_admin"} onChange={setPermissions} permissions={permissions} />
        {editable ? (
          <div className="temporary-reset-row">
            <label><span>{t("Issue a new temporary password (optional)")}</span><input minLength={12} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder={t("Leave blank to keep current password")} type="text" value={temporaryPassword} /></label>
            <button className="secondary-button" onClick={() => setTemporaryPassword(generateTemporaryPassword())} type="button">{t("Generate")}</button>
            <button className="secondary-button" disabled={!temporaryPassword} onClick={() => void navigator.clipboard.writeText(temporaryPassword)} type="button">{t("Copy")}</button>
          </div>
        ) : null}
        {message ? <div className="form-message">{message}</div> : null}
        {editable ? (
          <div className="user-action-row">
            <button className="primary-button" disabled={busy} onClick={() => void save()} type="button">{busy ? t("Saving…") : t("Save permissions")}</button>
            <button className="danger-button" disabled={busy || user.id === currentUserId || user.role === "super_admin"} onClick={() => void remove()} type="button">{t("Remove access")}</button>
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
  const { t } = useLanguage();
  const router = useRouter();
  const refresh = () => router.refresh();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="user-management-stack">
      {canManage ? <CreateUserPanel currentUserRole={currentUserRole} onCreated={refresh} /> : null}
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">{t("AUTHORIZED USERS")}</span><h2>{initialUsers.length} {t(initialUsers.length === 1 ? "account" : "accounts")}</h2></div>
          <div className="user-presence-summary"><span className="status-pill status-ready"><i /> {initialUsers.filter((user) => user.isOnline).length} {t("online now")}</span>{!canManage ? <span className="status-pill status-loading">{t("View only")}</span> : null}</div>
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
          {!initialUsers.length ? <div className="empty-user-list">{t("No Supabase users were found.")}</div> : null}
        </div>
      </section>
    </div>
  );
}

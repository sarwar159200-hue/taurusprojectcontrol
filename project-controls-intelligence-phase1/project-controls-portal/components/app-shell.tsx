"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CurrentUser } from "@/lib/types";
import { isAdminRole } from "@/lib/roles";
import { PRODUCT_NAME, PROJECT_NAME } from "@/lib/config";

const nav = [
  { href: "/dashboard", icon: "◫", label: "Executive Overview" },
  { href: "/dashboard/document-control", icon: "▤", label: "Document Control" },
  { href: "/dashboard/progress", icon: "⌁", label: "Progress & S-Curves" },
  { href: "/dashboard/schedule", icon: "▥", label: "Project Schedule" }
];

const adminNav = [
  { href: "/dashboard/admin/imports", icon: "⇧", label: "Import & Publish" },
  { href: "/dashboard/users", icon: "◎", label: "User Access" }
];

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = isAdminRole(user.role) ? [...nav, ...adminNav] : nav;

  return (
    <div className="app-frame">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span>P</span>C</div>
          <div>
            <strong>{PRODUCT_NAME}</strong>
            <small>CONTROLLED DATA PORTAL</small>
          </div>
        </div>
        <nav className="side-nav">
          <span className="nav-section-label">PROJECT CONTROL</span>
          {items.map((item, index) => {
            const active = pathname === item.href;
            const isFirstAdmin = index === nav.length;
            return (
              <div key={item.href}>
                {isFirstAdmin ? <span className="nav-section-label admin-label">ADMINISTRATION</span> : null}
                <Link className={active ? "active" : ""} href={item.href} onClick={() => setOpen(false)}>
                  <i>{item.icon}</i>
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.fullName}</strong>
            <small>{user.role.replaceAll("_", " ")}</small>
          </div>
          <form action="/api/auth/logout" method="post">
            <button title="Sign out" type="submit">↪</button>
          </form>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen((value) => !value)} type="button">☰</button>
          <div>
            <span>ACTIVE PROJECT</span>
            <strong>{PROJECT_NAME}</strong>
          </div>
          <div className="topbar-actions">
            <span className="live-indicator"><i /> Published data</span>
            <div className="date-badge"><span>DATA DATE</span><strong>01 Jun 2026</strong></div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

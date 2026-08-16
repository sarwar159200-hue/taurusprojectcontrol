"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ActivityTracker } from "@/components/activity-tracker";
import { LanguageSwitcher, useLanguage } from "@/components/language-provider";
import { ThemeToggle } from "@/components/theme-provider";
import { PRODUCT_NAME, PROJECT_NAME } from "@/lib/config";
import { canAccessSection } from "@/lib/permissions";
import type { CurrentUser, SectionKey } from "@/lib/types";

type NavigationItem = {
  href: string;
  icon: string;
  label: string;
  section: SectionKey;
};

const projectNav: NavigationItem[] = [
  { href: "/dashboard", icon: "◫", label: "Executive Overview", section: "overview" },
  { href: "/dashboard/document-control", icon: "▤", label: "Document Control", section: "document_control" },
  { href: "/dashboard/progress", icon: "⌁", label: "Progress & S-Curves", section: "progress" },
  { href: "/dashboard/schedule", icon: "▥", label: "Project Schedule", section: "schedule" }
];

const administrationNav: NavigationItem[] = [
  { href: "/dashboard/admin/imports", icon: "⇧", label: "Import & Publish", section: "imports" },
  { href: "/dashboard/users", icon: "◎", label: "User Access", section: "user_access" },
  { href: "/dashboard/activity", icon: "◷", label: "Activity Log", section: "activity_log" }
];

function NavigationLinks({ items, pathname, close, translate }: {
  items: NavigationItem[];
  pathname: string;
  close: () => void;
  translate: (value: string) => string;
}) {
  return items.map((item) => (
    <div key={item.href}>
      <Link className={pathname === item.href ? "active" : ""} href={item.href} onClick={close}>
        <i>{item.icon}</i>
        <span>{translate(item.label)}</span>
      </Link>
    </div>
  ));
}

export function AppShell({ user, children, dataDate }: { user: CurrentUser; children: React.ReactNode; dataDate?: string | null }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const projectItems = projectNav.filter((item) => canAccessSection(user, item.section));
  const administrationItems = administrationNav.filter((item) => canAccessSection(user, item.section));

  return (
    <div className="app-frame">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="taurus-logo-wrap sidebar-logo">
            <Image alt="Taurus" height={35} priority src="/taurus-logo.jpeg" width={140} />
          </div>
          <div>
            <strong>{PRODUCT_NAME}</strong>
            <small>{t("CONTROLLED DATA PORTAL")}</small>
          </div>
        </div>
        <nav className="side-nav">
          <span className="nav-section-label">{t("PROJECT CONTROL")}</span>
          <NavigationLinks items={projectItems} pathname={pathname} close={() => setOpen(false)} translate={t} />
          {administrationItems.length ? <span className="nav-section-label admin-label">{t("ADMINISTRATION")}</span> : null}
          <NavigationLinks items={administrationItems} pathname={pathname} close={() => setOpen(false)} translate={t} />
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.fullName}</strong>
            <small>{user.role.replaceAll("_", " ")}</small>
          </div>
          <form action="/api/auth/logout" method="post">
            <button title={t("Sign out")} type="submit">↪</button>
          </form>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen((value) => !value)} type="button">☰</button>
          <div>
            <span>{t("ACTIVE PROJECT")}</span>
            <strong>{PROJECT_NAME}</strong>
          </div>
          <div className="topbar-actions">
            <ThemeToggle compact />
            <LanguageSwitcher compact />
            <span className="live-indicator"><i /> {dataDate ? t("Published data") : t("Awaiting first publish")}</span>
            <div className="date-badge"><span>{t("DATA DATE")}</span><strong>{dataDate ?? t("Not published")}</strong></div>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <ActivityTracker />
      </div>
    </div>
  );
}

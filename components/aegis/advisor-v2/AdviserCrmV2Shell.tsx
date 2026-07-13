"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import AuthStatus from "@/components/aegis/auth/AuthStatus";
import {
  CRM_V2_CLASSIC_ADVISER_PATH,
  CRM_V2_HOME_PATH,
  CRM_V2_LEGACY_TOOLS_NAV,
  CRM_V2_MORE_NAV,
  CRM_V2_PRIMARY_NAV,
  CRM_V2_TOOLS_NAV_GROUPS,
  isCrmV2NavActive,
} from "@/lib/crm-v2/navigation";

interface AdviserCrmV2ShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

function NavLink({
  href,
  label,
  active,
  description,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  description?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={description}
      aria-current={active ? "page" : undefined}
      className={`block rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60 ${
        active
          ? "border border-[#D1A866]/25 bg-[#D1A866]/12 text-[#F3F1EA]"
          : "text-[#F3F1EA]/60 hover:bg-[#10283A]/50 hover:text-[#F3F1EA]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdviserCrmV2Shell({
  children,
  pageTitle,
}: AdviserCrmV2ShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const allNavItems = [
    ...CRM_V2_PRIMARY_NAV,
    ...CRM_V2_MORE_NAV,
    ...CRM_V2_LEGACY_TOOLS_NAV,
  ];

  const resolvedTitle =
    pageTitle ??
    (pathname === CRM_V2_HOME_PATH || pathname === "/advisor-v2"
      ? "AEGIS Adviser Workspace"
      : allNavItems.find((item) => isCrmV2NavActive(pathname, item.href))
          ?.label ?? "AEGIS Adviser Workspace");

  const moreActive = [...CRM_V2_MORE_NAV, ...CRM_V2_LEGACY_TOOLS_NAV].some(
    (item) => isCrmV2NavActive(pathname, item.href),
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#D1A866]/10 px-4 py-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#D1A866]/75">
          AEGIS Adviser Workspace
        </p>
        <p className="mt-2 text-xs font-light leading-relaxed text-[#F3F1EA]/40">
          Relationships, appointments, service, advice tools, and daily operations.
        </p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Adviser primary">
        <NavLink
          href={CRM_V2_HOME_PATH}
          label="Home"
          active={isCrmV2NavActive(pathname, CRM_V2_HOME_PATH)}
          onNavigate={() => setMenuOpen(false)}
        />
        {CRM_V2_PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={isCrmV2NavActive(pathname, item.href)}
            description={item.description}
            onNavigate={() => setMenuOpen(false)}
          />
        ))}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60 ${
              moreActive
                ? "border border-[#D1A866]/25 bg-[#D1A866]/12 text-[#F3F1EA]"
                : "text-[#F3F1EA]/60 hover:bg-[#10283A]/50 hover:text-[#F3F1EA]"
            }`}
          >
            More
            <span className="text-[#F3F1EA]/35" aria-hidden>
              {moreOpen ? "−" : "+"}
            </span>
          </button>
          {moreOpen ? (
            <div className="mt-1 space-y-3 pl-2" aria-label="Adviser more">
              <div className="space-y-1">
                <p className="px-3 pt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#F3F1EA]/28">
                  Workspace
                </p>
                {CRM_V2_MORE_NAV.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isCrmV2NavActive(pathname, item.href)}
                    description={item.description}
                    onNavigate={() => setMenuOpen(false)}
                  />
                ))}
              </div>
              {CRM_V2_TOOLS_NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-3 pt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#F3F1EA]/28">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <NavLink
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      label={item.label}
                      description={item.description}
                      active={isCrmV2NavActive(pathname, item.href)}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
      <div className="space-y-2 border-t border-[#D1A866]/10 p-3">
        <Link
          href={CRM_V2_CLASSIC_ADVISER_PATH}
          className="block rounded-sm px-3 py-2 text-[10px] font-light text-[#F3F1EA]/30 transition-colors hover:bg-[#10283A]/50 hover:text-[#F3F1EA]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
        >
          Classic workspace (fallback)
        </Link>
        <AuthStatus />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#071B2A] text-[#F3F1EA]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1A2A2B_0%,_transparent_50%)]" />
      <div className="relative flex min-h-screen">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[#071B2A]/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation overlay"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r border-[#D1A866]/10 bg-[#071B2A]/98 backdrop-blur-md transition-transform duration-300 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:bg-[#071B2A]/70 ${
            menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#D1A866]/10 bg-[#071B2A]/90 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#D1A866]/15 text-[#F3F1EA]/70 hover:border-[#D1A866]/30 lg:hidden"
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={menuOpen}
              >
                <span className="text-lg leading-none">≡</span>
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-light tracking-wide text-[#F3F1EA] sm:text-base">
                  {resolvedTitle}
                </h1>
              </div>
            </div>
            <div className="hidden items-center gap-4 lg:flex">
              <Link
                href={CRM_V2_CLASSIC_ADVISER_PATH}
                className="text-[10px] font-light text-[#F3F1EA]/30 transition-colors hover:text-[#F3F1EA]/50"
              >
                Classic fallback
              </Link>
              <AuthStatus />
            </div>
          </header>

          <main
            id="crm-v2-main"
            className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

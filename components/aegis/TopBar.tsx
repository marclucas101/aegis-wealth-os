"use client";

import { usePathname } from "next/navigation";
import AuthStatus from "@/components/aegis/auth/AuthStatus";
import { NAV_ITEMS } from "@/components/aegis/SidebarNav";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onMenuToggle?: () => void;
  menuOpen?: boolean;
}

function resolvePageTitle(pathname: string): string | undefined {
  const match = NAV_ITEMS.find(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label;
}

export default function TopBar({
  title,
  subtitle,
  onMenuToggle,
  menuOpen = false,
}: TopBarProps) {
  const pathname = usePathname();
  const resolvedTitle = title ?? resolvePageTitle(pathname) ?? "Wealth Architecture";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[#D1A866]/10 bg-[#071B2A]/90 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#D1A866]/15 text-[#F3F1EA]/70 transition-colors hover:border-[#D1A866]/30 hover:text-[#F3F1EA] lg:hidden"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
        >
          <span className="relative flex h-3.5 w-4 flex-col justify-between">
            <span
              className={`block h-px w-full bg-current transition-transform ${
                menuOpen ? "translate-y-[6.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-px w-full bg-current transition-opacity ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-px w-full bg-current transition-transform ${
                menuOpen ? "-translate-y-[6.5px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-light tracking-wide text-[#F3F1EA] sm:text-base">
            {resolvedTitle}
          </h1>
          {subtitle && (
            <p className="hidden truncate text-[10px] tracking-wide text-[#F3F1EA]/40 sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D1A866]/60" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
            Architecture Active
          </span>
        </div>
        <div className="hidden h-8 w-px bg-[#D1A866]/10 sm:block" />
        <AuthStatus />
      </div>
    </header>
  );
}

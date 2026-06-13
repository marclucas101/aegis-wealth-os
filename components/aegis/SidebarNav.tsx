"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import BrandLogo from "@/components/brand/BrandLogo";
import type { NavItem, NavSection } from "@/lib/navigation";
import { NAV_ITEMS, NAV_SECTIONS } from "@/lib/navigation";

function resolveActiveNavItem(
  pathname: string,
  items: NavItem[],
): NavItem | undefined {
  return items
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

interface SidebarNavProps {
  onNavigate?: () => void;
  /** Pre-filtered sections from the server. Never pass the unfiltered catalogue. */
  navSections?: NavSection[];
}

export default function SidebarNav({
  onNavigate,
  navSections,
}: SidebarNavProps) {
  const pathname = usePathname();
  const sections = navSections ?? [];

  return (
    <nav className="flex h-full flex-col">
      <div className="border-b border-[#D1A866]/10 px-6 py-7">
        <Link
          href="/"
          onClick={onNavigate}
          className="group transition-opacity hover:opacity-80"
        >
          <BrandLogo variant="full" size="sm" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {sections.length === 0 ? (
          <div className="px-3 py-2">
            <div className="h-4 w-24 animate-pulse rounded-sm bg-[#10283A]/80" />
            <div className="mt-3 space-y-2">
              <div className="h-8 animate-pulse rounded-sm bg-[#10283A]/60" />
              <div className="h-8 animate-pulse rounded-sm bg-[#10283A]/40" />
            </div>
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.title} className="mb-6 last:mb-0">
              <p className="mb-2 px-3 text-[9px] font-medium uppercase tracking-[0.22em] text-[#F3F1EA]/25">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {(() => {
                  const activeItem = resolveActiveNavItem(
                    pathname,
                    section.items,
                  );
                  return section.items.map((item) => {
                    const isActive = activeItem?.href === item.href;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className={`group relative flex flex-col rounded-sm px-3 py-2.5 transition-colors ${
                            isActive
                              ? "bg-[#D1A866]/8 text-[#F3F1EA]"
                              : "text-[#F3F1EA]/55 hover:bg-[#10283A]/60 hover:text-[#F3F1EA]/85"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute bottom-2 left-0 top-2 w-px bg-[#D1A866]/70" />
                          )}
                          <span
                            className={`text-[13px] font-light tracking-wide ${
                              isActive ? "text-[#F3F1EA]" : ""
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="mt-0.5 text-[10px] tracking-wide text-[#F3F1EA]/30 group-hover:text-[#F3F1EA]/40">
                              {item.description}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-[#D1A866]/10 px-6 py-5">
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
          Strategic Intelligence
        </p>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/20">
          Generational Wealth
        </p>
      </div>
    </nav>
  );
}

export { NAV_ITEMS, NAV_SECTIONS };

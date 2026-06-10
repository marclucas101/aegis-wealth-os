"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavItem {
  label: string;
  href: string;
  description?: string;
  adminOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", description: "Shield overview" },
      { label: "Profile", href: "/profile", description: "Account & client record" },
    ],
  },
  {
    title: "Architecture",
    items: [
      { label: "Discover", href: "/discover", description: "Financial profile" },
      {
        label: "Shield Diagnostic",
        href: "/shield-diagnostic",
        description: "Composite assessment",
      },
      {
        label: "Stress Testing",
        href: "/stress-testing",
        description: "Scenario simulations",
      },
      { label: "Roadmap", href: "/roadmap", description: "Priority actions" },
    ],
  },
  {
    title: "Deliverables",
    items: [
      {
        label: "Annual Review",
        href: "/annual-review",
        description: "Shield progression",
      },
      {
        label: "Wealth Blueprint",
        href: "/wealth-blueprint",
        description: "Institutional reports",
      },
      {
        label: "Document Vault",
        href: "/document-vault",
        description: "Architecture records",
      },
    ],
  },
  {
    title: "Advisory",
    items: [
      { label: "Advisor OS", href: "/advisor", description: "Client monitoring" },
      {
        label: "Admin Console",
        href: "/admin",
        description: "Roles & assignments",
        adminOnly: true,
      },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

function TriSpireMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M6 34V14L16 4L26 14V34"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M11 34V20L16 14L21 20V34"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <path
        d="M16 4V34"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.35"
      />
    </svg>
  );
}

interface SidebarNavProps {
  onNavigate?: () => void;
}

export default function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdminAccess() {
      try {
        const response = await fetch("/api/admin/users", {
          cache: "no-store",
        });

        if (!cancelled) {
          setIsAdmin(response.ok);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    }

    void checkAdminAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav className="flex h-full flex-col">
      <div className="border-b border-[#D1A866]/10 px-6 py-7">
        <Link
          href="/"
          onClick={onNavigate}
          className="group flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <div className="text-[#D1A866]">
            <TriSpireMark className="h-8 w-7" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]">
              AEGIS
            </p>
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
              Wealth OS™
            </p>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6 last:mb-0">
            <p className="mb-2 px-3 text-[9px] font-medium uppercase tracking-[0.22em] text-[#F3F1EA]/25">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

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
              })}
            </ul>
          </div>
        ))}
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

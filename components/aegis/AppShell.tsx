"use client";

import { useEffect, useState, type ReactNode } from "react";
import SidebarNav from "@/components/aegis/SidebarNav";
import TopBar from "@/components/aegis/TopBar";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** When true, children render without the default content container. */
  fullBleed?: boolean;
}

export default function AppShell({
  children,
  title,
  subtitle,
  fullBleed = false,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#071B2A] text-[#F3F1EA]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1A2A2B_0%,_transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#10283A_0%,_transparent_40%)]" />

      <div className="relative flex min-h-screen">
        {menuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[#071B2A]/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r border-[#D1A866]/10 bg-[#071B2A]/98 backdrop-blur-md transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:bg-[#071B2A]/60 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            title={title}
            subtitle={subtitle}
            menuOpen={menuOpen}
            onMenuToggle={() => setMenuOpen((open) => !open)}
          />

          <main className="flex-1 overflow-x-hidden">
            {fullBleed ? (
              children
            ) : (
              <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

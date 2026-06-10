import Link from "next/link";
import type { ReactNode } from "react";

import { DRAFT_LEGAL_WARNING, LEGAL_LINKS } from "@/lib/aegis/legal";

interface LegalPageShellProps {
  title: string;
  subtitle: string;
  lastUpdated?: string;
  children: ReactNode;
}

export default function LegalPageShell({
  title,
  subtitle,
  lastUpdated = "June 2026",
  children,
}: LegalPageShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071B2A] text-[#F3F1EA]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1A2A2B_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#10283A_0%,_transparent_45%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-10 border-b border-[#D1A866]/15 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/35 transition-colors hover:text-[#D1A866]/70"
          >
            <span aria-hidden>←</span>
            AEGIS Wealth OS
          </Link>

          <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/80">
            Legal & Compliance
          </p>
          <h1 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
            {subtitle}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#F3F1EA]/25">
            Last updated · {lastUpdated}
          </p>

          <div
            className="mt-6 rounded-sm border border-amber-500/25 bg-amber-500/8 px-4 py-3"
            role="note"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-amber-400/90">
              Draft template notice
            </p>
            <p className="mt-2 text-xs font-light leading-relaxed text-[#F3F1EA]/55">
              {DRAFT_LEGAL_WARNING}
            </p>
          </div>
        </header>

        <article className="prose-legal flex-1 space-y-8 text-sm font-light leading-relaxed text-[#F3F1EA]/60">
          {children}
        </article>

        <footer className="mt-14 border-t border-[#D1A866]/10 pt-8">
          <nav
            aria-label="Legal pages"
            className="flex flex-wrap justify-center gap-x-5 gap-y-2"
          >
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[10px] uppercase tracking-[0.16em] text-[#F3F1EA]/35 transition-colors hover:text-[#D1A866]/75"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 text-center text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
            AEGIS Wealth Operating System™ · Confidential
          </p>
        </footer>
      </div>
    </div>
  );
}

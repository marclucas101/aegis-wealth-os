"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AdvisorOverview } from "@/lib/supabase/advisorQueries";

interface AdvisorCommandHeaderProps {
  overview: AdvisorOverview;
}

function formatSessionDate(): string {
  return new Date().toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function AdvisorCommandHeader({
  overview,
}: AdvisorCommandHeaderProps) {
  const bookSummary = `${overview.totalClients} clients · ${overview.activeClients} active · ${overview.onboardingClients} onboarding`;

  return (
    <header
      className="relative overflow-hidden rounded-sm border border-[#D1A866]/18 bg-[#10283A]/70"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/8 via-transparent to-[#071B2A]/40" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D1A866]/25 to-transparent" />

      <div className="relative px-5 py-6 sm:px-6 sm:py-7 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/75">
                AEGIS Private Banking
              </p>
              <span className="hidden h-3 w-px bg-[#D1A866]/20 sm:block" />
              <p className="text-[10px] font-light uppercase tracking-[0.18em] text-[#F3F1EA]/35">
                Advisor mandate
              </p>
            </div>

            <div>
              <h1 className="text-2xl font-light tracking-tight text-[#F3F1EA] sm:text-3xl">
                Advisor Console
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
                Book of business command centre for Shield Score monitoring,
                review servicing, and advisory follow-up.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-light text-[#F3F1EA]/45">
              <span>{bookSummary}</span>
              {overview.averageShieldScore != null ? (
                <span className="font-mono text-[#D1A866]/80">
                  Avg Shield {formatScore(overview.averageShieldScore)}
                </span>
              ) : null}
              <time className="text-[#F3F1EA]/35">{formatSessionDate()}</time>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => scrollToSection("advisor-onboarding")}
              className="rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/18"
            >
              Add client
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("advisor-tasks")}
              className="rounded-sm border border-[#D1A866]/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/65 transition-colors hover:border-[#D1A866]/35 hover:text-[#F3F1EA]"
            >
              Create task
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("advisor-review-pipeline")}
              className="rounded-sm border border-[#D1A866]/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/65 transition-colors hover:border-[#D1A866]/35 hover:text-[#F3F1EA]"
            >
              Review pipeline
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

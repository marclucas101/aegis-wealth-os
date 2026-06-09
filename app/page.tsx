import Link from "next/link";

function TriSpireHero() {
  return (
    <svg
      viewBox="0 0 80 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-20 w-16 sm:h-24 sm:w-20"
      aria-hidden
    >
      <path
        d="M12 90V28L40 6L68 28V90"
        stroke="#D1A866"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M24 90V48L40 32L56 48V90"
        stroke="#D1A866"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M40 6V90"
        stroke="#D1A866"
        strokeWidth="0.8"
        opacity="0.25"
      />
      <line
        x1="12"
        y1="90"
        x2="68"
        y2="90"
        stroke="#D1A866"
        strokeWidth="0.8"
        opacity="0.35"
      />
    </svg>
  );
}

function ShieldRing() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-hidden
    >
      <circle
        cx="100"
        cy="100"
        r="88"
        stroke="#D1A866"
        strokeWidth="0.5"
        opacity="0.12"
      />
      <circle
        cx="100"
        cy="100"
        r="68"
        stroke="#D1A866"
        strokeWidth="0.5"
        opacity="0.08"
      />
      <circle
        cx="100"
        cy="100"
        r="48"
        stroke="#D1A866"
        strokeWidth="0.5"
        opacity="0.05"
      />
      <path
        d="M100 24 L148 52 L148 108 C148 138 100 168 100 168 C100 168 52 138 52 108 L52 52 Z"
        stroke="#D1A866"
        strokeWidth="0.6"
        opacity="0.06"
      />
    </svg>
  );
}

const METHODOLOGY = [
  "Discover",
  "Diagnose",
  "Benchmark",
  "Stress Test",
  "Roadmap",
  "Monitor",
] as const;

const CAPABILITIES = [
  {
    title: "AEGIS Shield Diagnostic™",
    description:
      "Measure financial resilience across foundation and outer shield pillars with institutional precision.",
  },
  {
    title: "Wealth Architecture™",
    description:
      "Map current position to target architecture with gap analysis and strategic prioritisation.",
  },
  {
    title: "Stress Testing™",
    description:
      "Simulate life and market events to understand shield durability before they occur.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071B2A] text-[#F3F1EA]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1A2A2B_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#10283A_0%,_transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_transparent_0%,_#071B2A_85%)]" />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-[28rem] w-[28rem] opacity-60 sm:-right-12 lg:right-8">
        <ShieldRing />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <TriSpireHero />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#D1A866]">
                AEGIS
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
                Wealth Operating System™
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <p className="hidden text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30 md:block">
              Institutional Wealth Architecture
            </p>
            <Link
              href="/dashboard"
              className="rounded-sm border border-[#D1A866]/20 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/50 transition-colors hover:border-[#D1A866]/35 hover:text-[#D1A866]/80"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16 sm:py-20 lg:py-24">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-8 w-px bg-[#D1A866]/50" />
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/80">
              AEGIS Strategic Wealth Architecture™
            </p>
          </div>

          <h1 className="max-w-3xl text-3xl font-light leading-[1.15] tracking-wide text-[#F3F1EA] sm:text-4xl lg:text-5xl">
            Operate your family&apos;s wealth through an institutional-grade
            architecture platform.
          </h1>

          <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-[#F3F1EA]/50 sm:text-lg">
            Not financial planning software. A measurable diagnostic framework
            to understand, strengthen, monitor, and transfer generational
            wealth.
          </p>

          <p className="mt-4 text-sm tracking-wide text-[#D1A866]/70">
            Strategic Intelligence. Generational Wealth.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="group inline-flex items-center justify-center gap-3 rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-8 py-3.5 text-sm font-light tracking-wide text-[#D1A866] transition-all hover:border-[#D1A866]/60 hover:bg-[#D1A866]/15"
            >
              <span>Enter Shield Dashboard</span>
              <span
                className="text-[#D1A866]/60 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                →
              </span>
            </Link>
            <p className="text-[11px] uppercase tracking-[0.15em] text-[#F3F1EA]/25">
              Phase 1C · Platform Foundation
            </p>
          </div>

          <div className="mt-16 border-t border-[#D1A866]/10 pt-10">
            <p className="mb-5 text-[9px] font-medium uppercase tracking-[0.24em] text-[#F3F1EA]/25">
              Methodology Sequence
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
              {METHODOLOGY.map((step, index) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
                    {step}
                  </span>
                  {index < METHODOLOGY.length - 1 && (
                    <span className="text-[#D1A866]/30" aria-hidden>
                      ·
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </main>

        <section className="grid gap-4 border-t border-[#D1A866]/10 pt-10 sm:grid-cols-3 sm:gap-6">
          {CAPABILITIES.map((capability) => (
            <article
              key={capability.title}
              className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-5 backdrop-blur-sm"
            >
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/75">
                {capability.title}
              </h2>
              <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
                {capability.description}
              </p>
            </article>
          ))}
        </section>

        <footer className="mt-12 border-t border-[#D1A866]/10 pt-6 text-center sm:mt-16">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/20">
            AEGIS Wealth Operating System™ · Confidential Architecture Platform
          </p>
        </footer>
      </div>
    </div>
  );
}

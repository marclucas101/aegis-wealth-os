"use client";

import Link from "next/link";

export default function StressEmptyState() {
  return (
    <div className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/50 p-8 sm:p-12">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="relative mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#D1A866]/20 bg-[#1A2A2B]/60">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-7 w-7 text-[#D1A866]/60"
            aria-hidden
          >
            <path
              d="M12 3L4 7v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-4z"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path
              d="M12 9v4M12 17h.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Stress Testing™
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          Complete Discover™ to activate institutional stress testing.
        </h2>
        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          Model how your financial architecture absorbs disruption across income,
          health, market, and estate scenarios — calibrated to your Discover™
          profile and shield pillar structure.
        </p>

        <div className="mt-8">
          <Link
            href="/discover"
            className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-8 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            Start Discover™ →
          </Link>
        </div>
      </div>
    </div>
  );
}

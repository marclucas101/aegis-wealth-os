"use client";

import Link from "next/link";
import type { NextBestAction } from "@/lib/aegis/clientJourney";

interface ClientNextBestActionProps {
  action: NextBestAction;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export default function ClientNextBestAction({
  action,
  secondaryHref,
  secondaryLabel,
}: ClientNextBestActionProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/25 bg-[#1A2A2B]/45">
      <div className="absolute right-0 top-0 h-40 w-40 bg-[radial-gradient(circle_at_top_right,_#D1A866_0%,_transparent_70%)] opacity-10" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/45 to-transparent" />

      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/80">
            Recommended Next Step
          </p>
          <h2 className="mt-2 text-lg font-light text-[#F3F1EA] sm:text-xl">
            {action.title}
          </h2>
          <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
            {action.description}
          </p>
          <p className="mt-3 text-xs text-[#F3F1EA]/35">{action.reason}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          <Link
            href={action.href}
            className="inline-flex rounded-sm border border-[#D1A866]/45 bg-[#D1A866]/12 px-6 py-3 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/22"
          >
            {action.ctaLabel} →
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="text-center text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40 transition-colors hover:text-[#F3F1EA]/65"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

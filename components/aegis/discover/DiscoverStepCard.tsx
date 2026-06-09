"use client";

import type { ReactNode } from "react";

interface DiscoverStepCardProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  completeness: number;
  children: ReactNode;
}

export default function DiscoverStepCard({
  stepNumber,
  totalSteps,
  title,
  subtitle,
  completeness,
  children,
}: DiscoverStepCardProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/4 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-3">
              <span className="font-mono text-[10px] tabular-nums uppercase tracking-[0.2em] text-[#D1A866]/60">
                {String(stepNumber).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
              </span>
              <span className="h-px w-6 bg-[#D1A866]/30" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/30">
                Institutional Data Capture
              </span>
            </div>
            <h2 className="text-xl font-light tracking-wide text-[#F3F1EA] sm:text-2xl">
              {title}
            </h2>
            <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
              {subtitle}
            </p>
          </div>

          <div className="shrink-0 rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 px-4 py-3 text-right">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
              Section Score
            </p>
            <p className="font-mono text-2xl font-light tabular-nums text-[#D1A866]">
              {Math.round(completeness)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative px-5 py-6 sm:px-8 sm:py-8">{children}</div>
    </section>
  );
}

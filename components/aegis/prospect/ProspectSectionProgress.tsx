"use client";

import {
  PROSPECT_PROFILE_SECTIONS,
  sectionCompletenessPercent,
} from "@/lib/aegis/prospectProfileSections";
import type { DiscoverCompleteness } from "@/src/lib/scoring/types";

type Props = {
  currentStep: number;
  completeness: DiscoverCompleteness;
};

export default function ProspectSectionProgress({
  currentStep,
  completeness,
}: Props) {
  const activeSectionIndex = PROSPECT_PROFILE_SECTIONS.findIndex((section) =>
    section.stepIndices.includes(currentStep),
  );

  return (
    <div className="mb-6 grid gap-2 sm:grid-cols-5">
      {PROSPECT_PROFILE_SECTIONS.map((section, index) => {
        const isActive = index === activeSectionIndex;
        const isPast = index < activeSectionIndex;
        const percent = Math.round(sectionCompletenessPercent(section, completeness));

        return (
          <div
            key={section.id}
            className={`rounded-sm border px-3 py-3 ${
              isActive
                ? "border-[#D1A866]/40 bg-[#D1A866]/10"
                : isPast
                  ? "border-[#D1A866]/20 bg-[#10283A]/50"
                  : "border-[#D1A866]/8 bg-[#071B2A]/30"
            }`}
          >
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#D1A866]/70">
              {section.shortLabel}
            </p>
            <p className="mt-1 text-[11px] font-light leading-snug text-[#F3F1EA]/55">
              {section.title}
            </p>
            {section.id !== "review_submit" ? (
              <p className="mt-2 font-mono text-[10px] text-[#F3F1EA]/35">
                {percent}%
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

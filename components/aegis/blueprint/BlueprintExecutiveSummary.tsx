"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { PILLAR_LABELS, type BlueprintPageResults } from "@/lib/aegis/localProfile";

interface BlueprintExecutiveSummaryProps {
  results: BlueprintPageResults;
  saveState?: "idle" | "saving" | "saved" | "error";
}

function buildExecutiveSummary(results: BlueprintPageResults): string[] {
  const { shield, awri, weakestPillars, projected, client } = results;
  const weakestLabels = weakestPillars.map((p) => p.label).join(", ");
  const improvement =
    projected.projectedAdjustedShieldScore - shield.adjustedShieldScore;
  const confidencePct = Math.round(shield.dataConfidenceFactor * 100);

  const paragraphs: string[] = [];

  paragraphs.push(
    `This Wealth Architecture Blueprint presents an institutional diagnostic assessment derived from information captured through Discover™. The composite Adjusted Shield Score of ${formatScore(shield.adjustedShieldScore)} reflects a ${shield.rating} rating across seven architecture pillars, indicating ${shield.rating === "AAA" || shield.rating === "AA" ? "a well-structured wealth position with meaningful resilience" : shield.rating === "A" || shield.rating === "BBB" ? "a broadly sound architecture with identifiable refinement opportunities" : "a developing architecture with clear areas for structural improvement"}.`
  );

  paragraphs.push(
    `The Architecture Wealth Resilience Index (AWRI) stands at ${formatScore(awri.awri)}, incorporating resilience, behavioural discipline, governance maturity, and continuity planning alongside the core shield assessment. Primary architecture attention is directed toward ${weakestLabels}, which represent the lowest-scoring pillars in the current diagnostic. These areas define the strategic focus for wealth architecture progression over the review period.`
  );

  if (improvement > 0) {
    paragraphs.push(
      `Implementation of the prioritised roadmap actions is projected to advance the Adjusted Shield Score from ${formatScore(shield.adjustedShieldScore)} to ${formatScore(projected.projectedAdjustedShieldScore)}, representing an estimated improvement of ${formatScore(improvement)} points. This projection assumes completion of the identified priority actions within their respective timelines and does not constitute a guarantee of outcome.`
    );
  } else {
    paragraphs.push(
      `The current architecture demonstrates relative balance across pillars. Continued monitoring and periodic review are recommended to maintain structural integrity as circumstances evolve.`
    );
  }

  paragraphs.push(
    `This assessment is based on client-provided information with a data confidence factor of ${confidencePct}%. ${confidencePct >= 80 ? "The profile completeness supports a high degree of diagnostic reliability." : confidencePct >= 60 ? "Additional profile detail would further strengthen diagnostic precision." : "Profile completeness is moderate; supplementary data would enhance assessment accuracy."} This document is prepared for architectural review purposes and does not constitute financial, legal, or tax advice.`
  );

  if (client.isBusinessOwner) {
    paragraphs.push(
      `As a business owner, continuity and succession considerations form an integral component of the overall architecture assessment. Governance and legacy pillar scores reflect the current state of business and family office readiness.`
    );
  }

  return paragraphs;
}

export default function BlueprintExecutiveSummary({
  results,
  saveState,
}: BlueprintExecutiveSummaryProps) {
  const paragraphs = buildExecutiveSummary(results);
  const primaryGap = results.weakestPillars[0];

  const saveHint =
    saveState === "saved"
      ? "Latest snapshot saved to cloud"
      : saveState === "error"
        ? "Cloud snapshot save failed"
        : null;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#1A2A2B]/40">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Section 02
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Executive Summary
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Institutional diagnostic overview · Wealth Architecture Blueprint™
          {saveHint ? ` · ${saveHint}` : ""}
        </p>
      </div>

      <div className="relative space-y-5 px-6 py-6 sm:px-8 sm:py-8">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="text-sm font-light leading-[1.85] text-[#F3F1EA]/75"
          >
            {paragraph}
          </p>
        ))}

        {primaryGap && (
          <div className="mt-6 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#D1A866]/60">
              Primary Architecture Focus
            </p>
            <p className="mt-2 text-sm text-[#F3F1EA]/70">
              {PILLAR_LABELS[primaryGap.pillar]} pillar · Score{" "}
              {formatScore(primaryGap.score)} · Priority remediation area
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

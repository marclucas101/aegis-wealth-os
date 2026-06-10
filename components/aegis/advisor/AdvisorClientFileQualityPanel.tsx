"use client";

import { useEffect, useState } from "react";

import AdvisorFileQualityChecklist from "@/components/aegis/advisor/AdvisorFileQualityChecklist";
import AdvisorFileQualityScore from "@/components/aegis/advisor/AdvisorFileQualityScore";
import type { ClientFileQuality } from "@/lib/supabase/clientFileQuality";

interface AdvisorClientFileQualityPanelProps {
  clientId: string;
}

type LoadState = "loading" | "ready" | "error";

export default function AdvisorClientFileQualityPanel({
  clientId,
}: AdvisorClientFileQualityPanelProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [quality, setQuality] = useState<ClientFileQuality | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuality() {
      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/file-quality`,
          { cache: "no-store" },
        );

        if (cancelled) return;

        if (!response.ok) {
          setLoadState("error");
          return;
        }

        const data = (await response.json()) as
          | { ok: true; quality: ClientFileQuality }
          | { ok: false };

        if (!data.ok) {
          setLoadState("error");
          return;
        }

        setQuality(data.quality);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    void loadQuality();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <section
      id="client-file-quality"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Client File Quality
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Readiness score, data completeness, and review preparation status.
        </p>
      </div>

      <div className="relative px-5 py-5">
        {loadState === "loading" ? (
          <p className="text-sm font-light text-[#F3F1EA]/45">
            Assessing client file quality…
          </p>
        ) : null}

        {loadState === "error" ? (
          <p className="text-sm font-light text-red-200/70">
            Unable to load file quality assessment.
          </p>
        ) : null}

        {loadState === "ready" && quality ? (
          <div className="space-y-6">
            <AdvisorFileQualityScore
              readinessScore={quality.readinessScore}
              readinessRating={quality.readinessRating}
              reviewReady={quality.reviewReady}
            />

            {quality.criticalGaps.length > 0 ? (
              <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-4 py-3">
                <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-red-300/90">
                  Critical gaps ({quality.criticalGaps.length})
                </p>
                <ul className="mt-2 space-y-1">
                  {quality.criticalGaps.map((gap) => (
                    <li
                      key={gap}
                      className="text-sm font-light text-red-200/80"
                    >
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <AdvisorFileQualityChecklist
              completedItems={quality.completedItems}
              missingItems={quality.missingItems}
            />

            {quality.recommendedNextActions.length > 0 ? (
              <div className="border-t border-[#D1A866]/10 pt-4">
                <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
                  Recommended next actions
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  {quality.recommendedNextActions.map((action) => (
                    <li
                      key={action}
                      className="text-sm font-light text-[#F3F1EA]/60"
                    >
                      {action}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

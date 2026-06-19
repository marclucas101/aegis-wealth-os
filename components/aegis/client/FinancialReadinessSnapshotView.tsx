"use client";

import type { ClientSafeEnvelope } from "@/lib/compliance/clientSafeDtos";
import type { ClientSafeFinancialReadinessSnapshot } from "@/lib/compliance/clientSafeDtos";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";
import CallMyAdviserPanel from "@/components/aegis/adviser/CallMyAdviserPanel";
import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";

const BAND_LABELS: Record<string, string> = {
  early_exploration: "Early exploration",
  building_foundation: "Building foundation",
  moderate_readiness: "Moderate readiness",
  strong_foundation: "Strong foundation",
  comprehensive: "Comprehensive information on file",
};

type Props = {
  envelope: ClientSafeEnvelope<ClientSafeFinancialReadinessSnapshot>;
};

export default function FinancialReadinessSnapshotView({ envelope }: Props) {
  const snapshot = envelope.data;
  const isFallback = envelope.accessMode === "fallback" || !snapshot;

  return (
    <>
      <ClientPortalHeader
        eyebrow={CLIENT_TERMINOLOGY.financialReadinessSnapshot}
        title={
          isFallback
            ? envelope.fallbackMessage ?? CLIENT_TERMINOLOGY.adviserReviewInProgress
            : "Your planning readiness overview"
        }
        subtitle={
          isFallback
            ? "Your adviser will provide a reviewed summary when ready."
            : CLIENT_TERMINOLOGY.basedOnInformationProvided
        }
      />

      {isFallback ? (
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-6 py-8">
          <p className="text-sm font-light text-[#F3F1EA]/70">
            {envelope.fallbackMessage}
          </p>
          {envelope.fallbackReason === "additional_information_required" && (
            <a
              href="/discover"
              className="mt-4 inline-block text-sm text-[#D1A866] underline"
            >
              Complete your information
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/45 px-6 py-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Readiness category
            </p>
            <p className="mt-2 text-lg font-light text-[#F3F1EA]">
              {BAND_LABELS[snapshot.readinessBand] ?? snapshot.readinessBand}
            </p>
            <p className="mt-2 text-sm font-light text-[#F3F1EA]/55">
              {snapshot.educationalExplanation}
            </p>
            <p className="mt-3 text-xs text-[#F3F1EA]/40">
              {CLIENT_TERMINOLOGY.dataAsAt(snapshot.dataAsAt)}
            </p>
          </section>

          {snapshot.broadStrengths.length > 0 && (
            <section>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
                {CLIENT_TERMINOLOGY.broadStrength}
              </p>
              <ul className="space-y-2">
                {snapshot.broadStrengths.map((item) => (
                  <li
                    key={item}
                    className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-[#F3F1EA]/75"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {snapshot.areasForAdviserReview.length > 0 && (
            <section>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
                {CLIENT_TERMINOLOGY.areaForAdviserReview}
              </p>
              <ul className="space-y-2">
                {snapshot.areasForAdviserReview.map((item) => (
                  <li
                    key={item}
                    className="rounded-sm border border-[#D1A866]/20 bg-[#D1A866]/5 px-4 py-3 text-sm text-[#F3F1EA]/75"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 px-5 py-4">
            <p className="text-sm text-[#F3F1EA]/60">
              Information completeness:{" "}
              <span className="font-mono text-[#D1A866]">
                {snapshot.informationCompletenessPercent}%
              </span>
            </p>
            <p className="mt-2 text-sm text-[#F3F1EA]/50">
              {snapshot.nextRecommendedAdministrativeStep}
            </p>
            {snapshot.appointmentCta && (
              <a
                href={snapshot.appointmentCta.href}
                className="mt-4 inline-block rounded-sm border border-[#D1A866]/30 px-4 py-2 text-sm text-[#D1A866]"
              >
                {snapshot.appointmentCta.label}
              </a>
            )}
          </section>
        </div>
      )}

      <div className="mt-8">
        <CallMyAdviserPanel />
      </div>

      <ClientTrustNotice variant="full" context="general" />
    </>
  );
}

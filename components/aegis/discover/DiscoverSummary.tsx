"use client";

import Link from "next/link";
import { useState } from "react";

import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import { SUBMISSION_PRIVACY_ACKNOWLEDGEMENT } from "@/lib/compliance/fieldExplanations";
import { LEGAL_ROUTES } from "@/lib/aegis/legal";
import type { DiscoverCompleteness, DiscoverScoreResult } from "@/src/lib/scoring/types";

export interface SectionSummary {
  id: keyof DiscoverCompleteness;
  title: string;
  completeness: number;
}

interface DiscoverSummaryProps {
  result: DiscoverScoreResult;
  sections: SectionSummary[];
  onBack: () => void;
  onSubmit: () => Promise<void>;
  saveWarning?: string | null;
  isSavingRemote?: boolean;
  isSubmitting?: boolean;
  submitError?: string | null;
}

function SaveStatusBanner({
  saveWarning,
  isSavingRemote,
}: {
  saveWarning?: string | null;
  isSavingRemote?: boolean;
}) {
  if (saveWarning) {
    return (
      <div
        role="status"
        className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3"
      >
        <p className="text-sm font-light text-amber-200/90">{saveWarning}</p>
      </div>
    );
  }

  if (isSavingRemote) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D1A866]" />
        <p className="text-sm font-light text-[#F3F1EA]/50">
          Saving to your secure account…
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-sm border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
      <span className="text-emerald-400/90">✓</span>
      <p className="text-sm font-light text-emerald-200/90">
        Profile saved — you can return and update anytime before your meeting.
      </p>
    </div>
  );
}

export default function DiscoverSummary({
  result,
  sections,
  onBack,
  onSubmit,
  saveWarning,
  isSavingRemote = false,
  isSubmitting = false,
  submitError,
}: DiscoverSummaryProps) {
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const missing = sections.filter((section) => section.completeness < 50);
  const confidencePct = Math.round(result.dataConfidenceFactor * 100);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 p-6 sm:p-10">
        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
            Review and submit
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
            Ready to submit for adviser review?
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
            Your assigned financial adviser will review this information to
            prepare for your discussion. The platform does not provide
            unsupervised personalised recommendations.
          </p>
        </div>
      </header>

      <SaveStatusBanner
        saveWarning={saveWarning}
        isSavingRemote={isSavingRemote}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
            Sections in good shape
          </p>
          <ul className="space-y-2">
            {sections
              .filter((section) => section.completeness >= 60)
              .map((section) => (
                <li
                  key={section.id}
                  className="flex items-center justify-between border-b border-[#D1A866]/6 pb-2 last:border-0"
                >
                  <span className="text-sm font-light text-[#F3F1EA]/70">
                    {section.title}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-emerald-400/80">
                    {Math.round(section.completeness)}%
                  </span>
                </li>
              ))}
          </ul>
        </section>

        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[#F3F1EA]/40">
            Missing important information
          </p>
          {missing.length > 0 ? (
            <ul className="space-y-2">
              {missing.map((section) => (
                <li
                  key={section.id}
                  className="flex items-center justify-between border-b border-[#D1A866]/6 pb-2 last:border-0"
                >
                  <span className="text-sm font-light text-[#F3F1EA]/50">
                    {section.title}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#F3F1EA]/30">
                    {Math.round(section.completeness)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-light text-[#F3F1EA]/50">
              Core sections meet the minimum for submission.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/45 p-6">
        <p className="text-sm text-[#F3F1EA]/55">
          Information completeness indicator:{" "}
          <span className="font-mono text-[#D1A866]">{confidencePct}%</span>
        </p>
        <p className="mt-2 text-xs text-[#F3F1EA]/40">
          This reflects how complete your answers are — not a financial score or
          recommendation.
        </p>
      </section>

      <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-6">
        <label className="flex cursor-pointer gap-3">
          <input
            type="checkbox"
            checked={privacyAcknowledged}
            onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
            className="mt-1"
          />
          <span className="text-sm font-light leading-relaxed text-[#F3F1EA]/65">
            {SUBMISSION_PRIVACY_ACKNOWLEDGEMENT}{" "}
            <Link href={LEGAL_ROUTES.consent} className="text-[#D1A866] underline">
              View consent overview
            </Link>
          </span>
        </label>
      </section>

      {submitError ? (
        <p className="text-sm text-amber-200/90" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-sm border border-[#D1A866]/20 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/60"
        >
          Edit profile
        </button>
        <button
          type="button"
          disabled={!privacyAcknowledged || isSubmitting || isSavingRemote}
          onClick={() => void onSubmit()}
          className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] disabled:opacity-40"
        >
          {isSubmitting ? "Submitting…" : "Submit for adviser review"}
        </button>
      </div>

      <ClientTrustNotice variant="compact" context="general" />
    </div>
  );
}

"use client";

import type { ClientSafeEnvelope } from "@/lib/compliance/clientSafeDtos";
import type { ClientSafeFallbackReason } from "@/lib/compliance/types";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

type Props = {
  title: string;
  envelope: ClientSafeEnvelope<unknown>;
};

export function isClientSafeEnvelopeResponse(
  data: unknown,
): data is { ok: true; envelope: ClientSafeEnvelope<unknown> } {
  if (!data || typeof data !== "object") {
    return false;
  }
  return (
    "ok" in data &&
    (data as { ok: boolean }).ok === true &&
    "envelope" in data &&
    typeof (data as { envelope: unknown }).envelope === "object"
  );
}

export default function ClientSafeFallbackPanel({ title, envelope }: Props) {
  const message =
    envelope.fallbackMessage ??
    CLIENT_TERMINOLOGY.adviserReviewInProgress;

  const showDiscoverLink =
    envelope.fallbackReason === "additional_information_required";

  const showAdviserLink =
    envelope.fallbackReason === "analysis_submitted" ||
    envelope.fallbackReason === "adviser_review_in_progress" ||
    envelope.fallbackReason === "review_appointment_recommended" ||
    envelope.fallbackReason === "no_current_published_summary";

  return (
    <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-6 py-8">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
        {title}
      </p>
      <p className="mt-3 text-sm font-light text-[#F3F1EA]/75">{message}</p>
      <p className="mt-2 text-xs text-[#F3F1EA]/45">
        {CLIENT_TERMINOLOGY.basedOnInformationProvided}. Personalised analysis
        requires adviser review before it can be shared with you.
      </p>
      {showDiscoverLink && (
        <a
          href="/discover"
          className="mt-4 inline-block text-sm text-[#D1A866] underline"
        >
          Complete your information
        </a>
      )}
      {showAdviserLink && (
        <a
          href="/my-adviser"
          className="mt-4 ml-0 inline-block text-sm text-[#D1A866] underline sm:ml-4"
        >
          Contact my adviser
        </a>
      )}
    </div>
  );
}

export type { ClientSafeFallbackReason };

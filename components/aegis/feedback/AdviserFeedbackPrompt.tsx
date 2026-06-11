"use client";

import { useEffect, useState } from "react";

import type { FeedbackPromptResponse } from "@/app/api/adviser-feedback/prompt/route";
import AdviserFeedbackForm from "@/components/aegis/feedback/AdviserFeedbackForm";
import AdviserFeedbackModal from "@/components/aegis/feedback/AdviserFeedbackModal";

type PromptPhase = "hidden" | "banner" | "form" | "thanks";

export default function AdviserFeedbackPrompt() {
  const [phase, setPhase] = useState<PromptPhase>("hidden");
  const [adviserName, setAdviserName] = useState<string | null>(null);
  const [adviserCompany, setAdviserCompany] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPrompt() {
      try {
        const response = await fetch("/api/adviser-feedback/prompt", {
          cache: "no-store",
        });
        const data = (await response.json()) as FeedbackPromptResponse;

        if (cancelled || !response.ok || !data.ok) {
          return;
        }

        if (data.prompt.shouldPrompt) {
          setAdviserName(data.prompt.adviserName);
          setAdviserCompany(data.prompt.adviserCompany);
          setPhase("banner");
        }
      } catch {
        // Non-blocking prompt — fail silently
      }
    }

    void loadPrompt();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDismiss() {
    setDismissing(true);

    try {
      await fetch("/api/adviser-feedback/prompt", { method: "POST" });
    } catch {
      // Still hide locally
    }

    setPhase("hidden");
    setDismissing(false);
  }

  if (phase === "hidden") {
    return null;
  }

  if (phase === "thanks") {
    return (
      <div className="rounded-sm border border-[#D1A866]/20 bg-[#10283A]/45 p-5 sm:p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Thank you
        </p>
        <p className="mt-2 text-sm font-light text-[#F3F1EA]/60">
          Your feedback has been received and will help maintain AEGIS advisory
          standards.
        </p>
      </div>
    );
  }

  if (phase === "form") {
    return (
      <AdviserFeedbackModal
        title="Help us refine your advisory experience"
        subtitle="Your feedback helps AEGIS maintain a high standard of client care across every adviser relationship."
        onClose={() => setPhase("banner")}
      >
        <AdviserFeedbackForm
          adviserName={adviserName}
          onSubmitted={() => setPhase("thanks")}
          onCancel={() => setPhase("banner")}
        />
      </AdviserFeedbackModal>
    );
  }

  return (
    <div className="rounded-sm border border-[#D1A866]/18 bg-[#10283A]/50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Advisory experience
          </p>
          <h3 className="mt-2 text-lg font-light text-[#F3F1EA]">
            Help us refine your advisory experience
          </h3>
          <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
            Your feedback helps AEGIS maintain a high standard of client care
            across every adviser relationship.
          </p>
          {adviserName && (
            <p className="mt-3 text-xs font-light text-[#F3F1EA]/40">
              Assigned adviser: {adviserName}
              {adviserCompany ? ` · ${adviserCompany}` : ""}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPhase("form")}
            className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            Share feedback
          </button>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            disabled={dismissing}
            className="inline-flex rounded-sm border border-[#F3F1EA]/15 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/55 transition-colors hover:border-[#F3F1EA]/25 disabled:opacity-50"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

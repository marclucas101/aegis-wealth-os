"use client";

import { useEffect, useState } from "react";

import AdvisorReviewPipelineCard from "@/components/aegis/advisor/AdvisorReviewPipelineCard";
import type { AdvisorReviewPipeline } from "@/lib/supabase/advisorReviewPipeline";

type PipelineSection = {
  key: keyof Pick<
    AdvisorReviewPipeline,
    | "dueThisMonth"
    | "overdue"
    | "highPriority"
    | "onboarding"
    | "recentlyCompleted"
  >;
  label: string;
  description: string;
};

const SECTIONS: PipelineSection[] = [
  {
    key: "overdue",
    label: "Overdue",
    description: "Annual reviews past 15 months",
  },
  {
    key: "dueThisMonth",
    label: "Due This Month",
    description: "Reviews due within the current month",
  },
  {
    key: "highPriority",
    label: "High Priority",
    description: "Low Shield Score or weak rating signals",
  },
  {
    key: "onboarding",
    label: "Onboarding",
    description: "Prospective and onboarding clients",
  },
  {
    key: "recentlyCompleted",
    label: "Recently Completed",
    description: "Annual reviews completed in the last 30 days",
  },
];

interface AdvisorReviewPipelinePanelProps {
  pipeline?: AdvisorReviewPipeline | null;
  errorMessage?: string | null;
  onRefresh?: () => Promise<void>;
}

export default function AdvisorReviewPipelinePanel({
  pipeline: initialPipeline = null,
  errorMessage = null,
  onRefresh,
}: AdvisorReviewPipelinePanelProps) {
  const [pipeline, setPipeline] = useState<AdvisorReviewPipeline | null>(
    initialPipeline,
  );
  const [activeSection, setActiveSection] =
    useState<PipelineSection["key"]>("overdue");

  useEffect(() => {
    setPipeline(initialPipeline);

    if (initialPipeline) {
      const firstNonEmpty = SECTIONS.find(
        (section) => initialPipeline[section.key].length > 0,
      );
      if (firstNonEmpty) {
        setActiveSection(firstNonEmpty.key);
      }
    }
  }, [initialPipeline]);

  if (errorMessage) {
    return (
      <section
        id="advisor-review-pipeline"
        className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center"
      >
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Unable to load review pipeline.
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
          >
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  if (!pipeline) {
    return (
      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-12 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading review pipeline…
        </p>
      </section>
    );
  }

  const activeClients = pipeline[activeSection];
  const activeMeta = SECTIONS.find((section) => section.key === activeSection)!;

  return (
    <section
      id="advisor-review-pipeline"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Review Pipeline
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Upcoming reviews, overdue servicing, onboarding, and priority actions
          across your client book.
        </p>
      </div>

      <div className="relative flex flex-wrap gap-2 border-b border-[#D1A866]/10 px-5 py-3">
        {SECTIONS.map((section) => {
          const count = pipeline.summary[
            `${section.key}Count` as keyof AdvisorReviewPipeline["summary"]
          ] as number;
          const isActive = activeSection === section.key;

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.12em] transition-colors ${
                isActive
                  ? "border-[#D1A866]/40 bg-[#D1A866]/10 text-[#D1A866]"
                  : "border-[#D1A866]/15 bg-[#071B2A]/40 text-[#F3F1EA]/50 hover:border-[#D1A866]/25 hover:text-[#F3F1EA]/70"
              }`}
            >
              {section.label}
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  isActive ? "text-[#D1A866]" : "text-[#F3F1EA]/40"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative px-5 py-4">
        <p className="text-xs font-light text-[#F3F1EA]/40">
          {activeMeta.description}
        </p>

        {activeClients.length === 0 ? (
          <p className="mt-6 py-6 text-center text-sm font-light text-[#F3F1EA]/45">
            No clients in this pipeline stage.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeClients.map((client) => (
              <AdvisorReviewPipelineCard key={client.clientId} client={client} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

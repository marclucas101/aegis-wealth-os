"use client";

import Link from "next/link";
import type {
  ClientJourneyStep,
  JourneyStepStatus,
} from "@/lib/aegis/clientJourney";

interface JourneyStepWithStatus extends ClientJourneyStep {
  status: JourneyStepStatus;
}

interface ClientJourneyProgressProps {
  steps: JourneyStepWithStatus[];
  compact?: boolean;
}

function statusStyles(status: JourneyStepStatus, isActiveLink: boolean): string {
  if (status === "complete") {
    return isActiveLink
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300/90"
      : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300/80";
  }
  if (status === "current") {
    return "border-[#D1A866]/50 bg-[#D1A866]/12 text-[#D1A866]";
  }
  return "border-[#F3F1EA]/10 bg-[#071B2A]/40 text-[#F3F1EA]/35";
}

export default function ClientJourneyProgress({
  steps,
  compact = false,
}: ClientJourneyProgressProps) {
  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  if (compact) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/40">
            Journey · {completedCount} of {steps.length} modules ready
          </p>
          <p className="font-mono text-xs tabular-nums text-[#D1A866]">
            {progressPercent}%
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#D1A866]/10">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/60 to-[#D1A866] transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50">
      <div className="border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Your Journey
            </p>
            <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/55">
              A guided path from profile to plan — at your pace
            </p>
          </div>
          <p className="font-mono text-sm tabular-nums text-[#D1A866]">
            {progressPercent}% complete
          </p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#D1A866]/10">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/50 via-[#D1A866]/80 to-[#D1A866] transition-all duration-700"
            style={{ width: `${Math.max(progressPercent, 8)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-px bg-[#D1A866]/8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const isCurrent = step.status === "current";

          return (
            <Link
              key={step.id}
              href={step.href}
              className={`group flex flex-col gap-2 bg-[#10283A]/80 p-4 transition-colors hover:bg-[#10283A] sm:p-5 ${
                isCurrent ? "ring-1 ring-inset ring-[#D1A866]/25" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-wider ${statusStyles(step.status, false)}`}
                >
                  {step.status === "complete"
                    ? "Done"
                    : step.status === "current"
                      ? "Up next"
                      : "Later"}
                </span>
                <span className="text-[10px] text-[#F3F1EA]/25 group-hover:text-[#F3F1EA]/40">
                  →
                </span>
              </div>
              <p className="text-sm font-light text-[#F3F1EA]/85">{step.label}</p>
              <p className="text-xs font-light leading-relaxed text-[#F3F1EA]/40">
                {step.clientDescription}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

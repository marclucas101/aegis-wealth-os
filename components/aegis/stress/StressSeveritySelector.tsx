"use client";

import type { StressSeverity } from "@/src/lib/scoring/types";
import { STRESS_SEVERITY_PLAIN } from "@/lib/aegis/clientJourney";

const SEVERITY_ORDER: StressSeverity[] = [
  "mild",
  "moderate",
  "severe",
  "extreme",
];

interface StressSeveritySelectorProps {
  value: StressSeverity;
  onChange: (severity: StressSeverity) => void;
  allowedSeverities?: StressSeverity[];
  disabled?: boolean;
}

export default function StressSeveritySelector({
  value,
  onChange,
  allowedSeverities,
  disabled = false,
}: StressSeveritySelectorProps) {
  const options = allowedSeverities
    ? SEVERITY_ORDER.filter((severity) =>
        allowedSeverities.includes(severity),
      ).map((severity) => ({
        value: severity,
        ...STRESS_SEVERITY_PLAIN[severity],
      }))
    : SEVERITY_ORDER.map((severity) => ({
        value: severity,
        ...STRESS_SEVERITY_PLAIN[severity],
      }));

  return (
    <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          How severe should we model?
        </p>
        <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/55">
          Choose how big the disruption is. All scenarios update together so
          you can compare fairly.
        </p>
      </div>

      <div
        className={`grid gap-2 ${
          options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`rounded-sm border px-3 py-3 text-left transition-colors ${
                selected
                  ? "border-[#D1A866]/50 bg-[#D1A866]/15 ring-1 ring-[#D1A866]/20"
                  : "border-[#D1A866]/10 bg-[#1A2A2B]/30 hover:border-[#D1A866]/25 hover:bg-[#1A2A2B]/50"
              }`}
            >
              <p
                className={`text-xs font-medium uppercase tracking-[0.12em] ${
                  selected ? "text-[#D1A866]" : "text-[#F3F1EA]/75"
                }`}
              >
                {option.label}
              </p>
              <p className="mt-1 text-xs font-light leading-relaxed text-[#F3F1EA]/40">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

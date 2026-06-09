"use client";

import type { StressSeverity } from "@/src/lib/scoring/types";

const SEVERITY_OPTIONS: Array<{
  value: StressSeverity;
  label: string;
  description: string;
}> = [
  { value: "mild", label: "Mild", description: "0.50× penalty multiplier" },
  { value: "moderate", label: "Moderate", description: "1.00× penalty multiplier" },
  { value: "severe", label: "Severe", description: "1.50× penalty multiplier" },
  { value: "extreme", label: "Extreme", description: "2.00× penalty multiplier" },
];

interface StressSeveritySelectorProps {
  value: StressSeverity;
  onChange: (severity: StressSeverity) => void;
}

export default function StressSeveritySelector({
  value,
  onChange,
}: StressSeveritySelectorProps) {
  return (
    <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Scenario Severity
        </p>
        <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/55">
          Adjust disruption intensity across all modelled events
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {SEVERITY_OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-sm border px-3 py-3 text-left transition-colors ${
                selected
                  ? "border-[#D1A866]/50 bg-[#D1A866]/15"
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
              <p className="mt-1 font-mono text-[10px] tabular-nums text-[#F3F1EA]/35">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

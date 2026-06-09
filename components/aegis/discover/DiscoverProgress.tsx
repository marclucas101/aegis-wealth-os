"use client";

export interface DiscoverStep {
  id: string;
  title: string;
  shortLabel: string;
}

interface DiscoverProgressProps {
  steps: DiscoverStep[];
  currentStep: number;
  sectionCompleteness: number[];
}

export default function DiscoverProgress({
  steps,
  currentStep,
  sectionCompleteness,
}: DiscoverProgressProps) {
  const progressPercent = ((currentStep + 1) / steps.length) * 100;
  const overallCompleteness =
    sectionCompleteness.reduce((sum, value) => sum + value, 0) /
    sectionCompleteness.length;

  return (
    <div className="mb-8 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/70">
            Discover™ Profile Architecture
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-[#F3F1EA]/45">
            Section {currentStep + 1} of {steps.length}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
            Profile Completeness
          </p>
          <p className="font-mono text-sm tabular-nums text-[#D1A866]">
            {Math.round(overallCompleteness)}%
          </p>
        </div>
      </div>

      <div className="relative h-px w-full bg-[#D1A866]/10">
        <div
          className="absolute left-0 top-0 h-px bg-gradient-to-r from-[#D1A866]/80 to-[#D1A866]/40 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="hidden gap-1 lg:grid lg:grid-cols-11">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isPast = index < currentStep;
          const completeness = sectionCompleteness[index] ?? 0;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-sm border text-[10px] font-mono tabular-nums transition-colors ${
                  isActive
                    ? "border-[#D1A866]/60 bg-[#D1A866]/15 text-[#D1A866]"
                    : isPast
                      ? "border-[#D1A866]/30 bg-[#D1A866]/8 text-[#D1A866]/70"
                      : "border-[#D1A866]/10 bg-[#10283A]/40 text-[#F3F1EA]/30"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`hidden text-center text-[8px] uppercase tracking-[0.08em] xl:block ${
                  isActive ? "text-[#D1A866]/80" : "text-[#F3F1EA]/25"
                }`}
              >
                {step.shortLabel}
              </span>
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-[#D1A866]/8">
                <div
                  className="h-full bg-[#D1A866]/40 transition-all duration-300"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm font-light text-[#F3F1EA]/60 lg:hidden">
        {steps[currentStep]?.title}
      </p>
    </div>
  );
}

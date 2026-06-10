"use client";

export default function AdvisorEmptyState() {
  return (
    <div className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/50 p-8 sm:p-12">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="relative mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#D1A866]/20 bg-[#1A2A2B]/60">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-7 w-7 text-[#D1A866]/60"
            aria-hidden
          >
            <path
              d="M4 19V5h16v14H4z"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M8 9h8M8 13h5"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Advisor Console
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          No clients in your advisory portfolio yet.
        </h2>
        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          When clients are assigned to your mandate, their Shield Scores, risk
          exposures, roadmap progress, and activity will appear here for
          institutional monitoring and follow-up.
        </p>
        <p className="mt-3 text-xs font-light leading-relaxed text-[#F3F1EA]/30">
          Use the onboarding panel above to add prospective clients and invite
          them to sign up. They will be assigned to your mandate automatically.
        </p>
      </div>
    </div>
  );
}

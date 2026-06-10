"use client";

import Link from "next/link";

interface ClientEmptyStateProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  steps?: string[];
}

export default function ClientEmptyState({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryAction,
  steps,
}: ClientEmptyStateProps) {
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
              d="M12 3L4 7v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-4z"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          {title}
        </h2>
        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          {description}
        </p>

        {steps && steps.length > 0 && (
          <ol className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            {steps.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 text-sm font-light text-[#F3F1EA]/55"
              >
                <span className="font-mono text-[10px] text-[#D1A866]/60">
                  {index + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        )}

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={primaryHref}
            className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-8 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            {primaryLabel}
          </Link>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex rounded-sm border border-[#F3F1EA]/15 bg-transparent px-8 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/55 transition-colors hover:border-[#F3F1EA]/25 hover:text-[#F3F1EA]/75"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { toTelHref } from "@/lib/aegis/phone";

type CallMyAdviserButtonProps = {
  adviserName?: string | null;
  adviserPhone?: string | null;
  adviserCompany?: string | null;
  variant?: "card" | "compact";
  className?: string;
};

const BUTTON_CLASS =
  "inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20";

const DISABLED_CLASS =
  "inline-flex cursor-not-allowed rounded-sm border border-[#F3F1EA]/15 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/35";

export default function CallMyAdviserButton({
  adviserName,
  adviserPhone,
  adviserCompany,
  variant = "card",
  className = "",
}: CallMyAdviserButtonProps) {
  const telHref = adviserPhone ? toTelHref(adviserPhone) : null;

  if (variant === "compact") {
    if (!telHref) {
      return (
        <span className={`${DISABLED_CLASS} ${className}`}>
          Adviser phone not available
        </span>
      );
    }

    return (
      <a href={telHref} className={`${BUTTON_CLASS} ${className}`}>
        Call My Adviser →
      </a>
    );
  }

  return (
    <div
      className={`rounded-sm border border-[#D1A866]/15 bg-[#10283A]/45 p-5 sm:p-6 ${className}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
        Your adviser
      </p>

      {adviserName && (
        <p className="mt-2 text-base font-light text-[#F3F1EA]">{adviserName}</p>
      )}

      {adviserCompany && (
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          {adviserCompany}
        </p>
      )}

      <div className="mt-5">
        {telHref ? (
          <a href={telHref} className={BUTTON_CLASS}>
            Call My Adviser →
          </a>
        ) : (
          <span className={DISABLED_CLASS}>Adviser phone not available</span>
        )}
      </div>

      <p className="mt-3 text-[10px] font-light text-[#F3F1EA]/30">
        Opens your device&apos;s call app.
      </p>
    </div>
  );
}

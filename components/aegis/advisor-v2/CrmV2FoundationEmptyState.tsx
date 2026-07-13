import Link from "next/link";

import CrmV2PhaseNotice from "@/components/aegis/advisor-v2/CrmV2PhaseNotice";
import { CRM_V2_CLASSIC_ADVISER_PATH } from "@/lib/crm-v2/navigation";

interface CrmV2FoundationEmptyStateProps {
  moduleName: string;
  phase?: string;
  message: string;
  nextStep?: string;
  variant?: "foundation" | "unavailable" | "empty";
}

export default function CrmV2FoundationEmptyState({
  moduleName,
  phase,
  message,
  nextStep,
  variant = "foundation",
}: CrmV2FoundationEmptyStateProps) {
  const statusLabel =
    variant === "unavailable"
      ? "Not available in this workspace"
      : variant === "empty"
        ? "Nothing here yet"
        : phase
          ? `Foundation · ${phase}`
          : "Foundation";

  return (
    <div className="max-w-2xl">
      {variant === "foundation" && phase ? (
        <CrmV2PhaseNotice phase={phase} message={message} />
      ) : (
        <div
          className="rounded-sm border border-[#D1A866]/18 bg-[#1A2A2B]/40 px-4 py-4"
          role="status"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
            {statusLabel}
          </p>
          <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/55">
            {message}
          </p>
          {nextStep ? (
            <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/40">
              {nextStep}
            </p>
          ) : null}
        </div>
      )}
      {variant !== "foundation" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/advisor-v2/today"
            className="inline-flex rounded-sm border border-[#D1A866]/25 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/85 transition-colors hover:border-[#D1A866]/40 hover:bg-[#D1A866]/8"
          >
            Go to Today
          </Link>
          <Link
            href={CRM_V2_CLASSIC_ADVISER_PATH}
            className="inline-flex rounded-sm border border-[#F3F1EA]/12 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/50 transition-colors hover:border-[#F3F1EA]/25 hover:text-[#F3F1EA]/70"
          >
            Classic adviser workspace
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-xs font-light uppercase tracking-[0.14em] text-[#F3F1EA]/25">
          {moduleName}
        </p>
      )}
    </div>
  );
}

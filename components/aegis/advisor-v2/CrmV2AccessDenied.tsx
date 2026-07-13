import Link from "next/link";

import { CRM_V2_CLASSIC_ADVISER_PATH } from "@/lib/crm-v2/navigation";

export default function CrmV2AccessDenied() {
  return (
    <div className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/50 p-8 sm:p-12">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative mx-auto max-w-lg text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          AEGIS Adviser CRM V2
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          CRM V2 is not available
        </h2>
        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          This workspace is restricted to authorised pilot advisers during the
          controlled rollout.
        </p>
        <p className="mt-3 text-xs font-light leading-relaxed text-[#F3F1EA]/30">
          Your existing adviser portal remains available separately.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={CRM_V2_CLASSIC_ADVISER_PATH}
            className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            Open classic adviser workspace
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex rounded-sm border border-[#F3F1EA]/15 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/60 hover:bg-[#071B2A]/50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

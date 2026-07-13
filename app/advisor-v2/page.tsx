import Link from "next/link";

import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import {
  CRM_V2_MORE_NAV,
  CRM_V2_PRIMARY_NAV,
} from "@/lib/crm-v2/navigation";

export default function AdviserCrmV2LandingPage() {
  const areas = [...CRM_V2_PRIMARY_NAV, ...CRM_V2_MORE_NAV];

  return (
    <>
      <CrmV2PageHeader
        title="Adviser workspace"
        subtitle="Your CRM V2 pilot home. Choose an area below or use the navigation to move through relationships, appointments, service, and operations."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-sm border border-[#D1A866]/14 bg-[#10283A]/45 px-4 py-4 transition-colors hover:border-[#D1A866]/28 hover:bg-[#10283A]/70"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/85 group-hover:text-[#D1A866]">
              {item.label}
            </p>
            <p className="mt-2 text-xs font-light leading-relaxed text-[#F3F1EA]/40">
              Open {item.label.toLowerCase()} workspace
            </p>
          </Link>
        ))}
      </div>
      <p className="mt-8 max-w-2xl text-xs font-light leading-relaxed text-[#F3F1EA]/35">
        This is a limited pilot — not a full production launch. Projections and
        drafts stay advisory-only until you confirm actions in the classic
        workspace or governed flows.
      </p>
    </>
  );
}

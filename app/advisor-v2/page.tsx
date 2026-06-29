import Link from "next/link";

import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import CrmV2PhaseNotice from "@/components/aegis/advisor-v2/CrmV2PhaseNotice";
import CrmV2SectionPanel from "@/components/aegis/advisor-v2/CrmV2SectionPanel";
import {
  CRM_V2_DOMAIN_PILLARS,
  CRM_V2_MORE_NAV,
  CRM_V2_PRIMARY_NAV,
} from "@/lib/crm-v2/navigation";

export default function AdviserCrmV2LandingPage() {
  const moduleLinks = [
    ...CRM_V2_PRIMARY_NAV.filter((item) => item.href !== "/advisor-v2"),
    ...CRM_V2_MORE_NAV,
  ];

  return (
    <>
      <CrmV2PageHeader
        title="AEGIS Adviser CRM V2"
        subtitle="Foundation shell for the parallel adviser operating system. Business domains are introduced in later phases."
        phase="Phase 01"
      />

      <CrmV2PhaseNotice
        phase="Phase 01"
        message="CRM V2 is enabled only for operator-approved pilot advisers. The existing adviser portal at /advisor remains available during rollout."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <CrmV2SectionPanel title="Operating model">
          <ul className="space-y-3">
            {CRM_V2_DOMAIN_PILLARS.map((pillar) => (
              <li key={pillar.label} className="flex gap-3 text-sm text-[#F3F1EA]/60">
                <span className="mt-2 h-px w-3 shrink-0 bg-[#D1A866]/50" aria-hidden />
                <span>
                  <span className="text-[#F3F1EA]/85">{pillar.label}</span>
                  <span className="text-[#F3F1EA]/40"> — {pillar.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </CrmV2SectionPanel>

        <CrmV2SectionPanel title="Foundation modules">
          <ul className="space-y-2">
            {moduleLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[#D1A866]/90 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </CrmV2SectionPanel>
      </div>

      <p className="mt-8 text-xs font-light text-[#F3F1EA]/30">
        The CRM operating dashboard will be introduced after its relationship,
        appointment and service sources are established.
      </p>
    </>
  );
}

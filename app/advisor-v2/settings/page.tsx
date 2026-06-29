import Link from "next/link";

import CrmV2FoundationPlaceholderPage from "@/components/aegis/advisor-v2/CrmV2FoundationPlaceholderPage";
import CrmV2SectionPanel from "@/components/aegis/advisor-v2/CrmV2SectionPanel";

export default function CrmV2SettingsPage() {
  return (
    <>
      <CrmV2FoundationPlaceholderPage
        title="Settings"
        phase="Phase 01"
        message="CRM V2 settings will expand in later phases. Profile and calendar setup remain in the existing adviser portal during foundation rollout."
      />
      <CrmV2SectionPanel title="Existing adviser settings">
        <p className="text-sm font-light text-[#F3F1EA]/55">
          Use your current adviser profile for calendar connection and booking
          configuration until CRM V2 settings are expanded.
        </p>
        <Link
          href="/advisor/my-profile"
          className="mt-4 inline-flex text-sm text-[#D1A866]/90 underline-offset-4 hover:underline"
        >
          Open adviser profile
        </Link>
        <Link
          href="/advisor-v2/settings/integrations/google-calendar"
          className="mt-2 block text-sm text-[#D1A866]/90 underline-offset-4 hover:underline"
        >
          Open CRM V2 Google Calendar integration
        </Link>
      </CrmV2SectionPanel>
    </>
  );
}

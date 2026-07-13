import AdviserCrmV2LandingContent from "@/components/aegis/advisor-v2/AdviserCrmV2LandingContent";
import AdviserCrmV2Shell from "@/components/aegis/advisor-v2/AdviserCrmV2Shell";
import ClassicAdvisorWorkspace from "@/components/aegis/advisor/ClassicAdvisorWorkspace";
import { isCrmV2PilotAvailable } from "@/lib/crm-v2/pilotAvailability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorPage() {
  if (await isCrmV2PilotAvailable()) {
    return (
      <AdviserCrmV2Shell>
        <AdviserCrmV2LandingContent />
      </AdviserCrmV2Shell>
    );
  }

  return <ClassicAdvisorWorkspace />;
}

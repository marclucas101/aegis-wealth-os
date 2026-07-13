import AdvisorDashboardClient from "@/components/aegis/advisor/AdvisorDashboardClient";
import CrmV2PilotEntryBanner from "@/components/aegis/advisor/CrmV2PilotEntryBanner";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorPage() {
  return (
    <AuthenticatedAppShell>
      <CrmV2PilotEntryBanner />
      <AdvisorDashboardClient />
    </AuthenticatedAppShell>
  );
}

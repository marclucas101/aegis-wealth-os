import AdviserInsightsManagerClient from "@/components/aegis/advisor/insights/AdviserInsightsManagerClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdviserInsightsPage() {
  return (
    <AuthenticatedAppShell
      title="Insights Authoring"
      subtitle="Create governed educational content and adviser messages for your assigned clients."
    >
      <AdviserInsightsManagerClient />
    </AuthenticatedAppShell>
  );
}

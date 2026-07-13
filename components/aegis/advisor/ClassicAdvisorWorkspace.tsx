import AdvisorDashboardClient from "@/components/aegis/advisor/AdvisorDashboardClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

/**
 * Legacy adviser command centre — Shield Score, review pipeline, client roster.
 * No CRM V2 redirect or pilot entry UI.
 */
export default function ClassicAdvisorWorkspace() {
  return (
    <AuthenticatedAppShell>
      <AdvisorDashboardClient />
    </AuthenticatedAppShell>
  );
}

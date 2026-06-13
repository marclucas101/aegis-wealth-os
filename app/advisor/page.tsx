import AdvisorDashboardClient from "@/components/aegis/advisor/AdvisorDashboardClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorPage() {
  return (
    <AuthenticatedAppShell>
      <AdvisorDashboardClient />
    </AuthenticatedAppShell>
  );
}

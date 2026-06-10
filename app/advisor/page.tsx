import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AdvisorDashboardClient from "@/components/aegis/advisor/AdvisorDashboardClient";
import AppShell from "@/components/aegis/AppShell";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export default async function AdvisorPage() {
  const access = await requireAdvisorAccess();

  return (
    <AppShell
      title="Advisor Console"
      subtitle="Multi-client command centre for Shield Score monitoring and advisory follow-up"
    >
      {access.allowed ? <AdvisorDashboardClient /> : <AdvisorAccessDenied />}
    </AppShell>
  );
}

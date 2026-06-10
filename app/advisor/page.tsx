import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AdvisorDashboardClient from "@/components/aegis/advisor/AdvisorDashboardClient";
import AppShell from "@/components/aegis/AppShell";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorPage() {
  const access = await requireAdvisorAccess();

  return (
    <AppShell>
      {access.allowed ? <AdvisorDashboardClient /> : <AdvisorAccessDenied />}
    </AppShell>
  );
}

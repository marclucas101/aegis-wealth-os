import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import ProtectionReportClient from "@/components/aegis/advisor/protection-report/ProtectionReportClient";
import AppShell from "@/components/aegis/AppShell";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectionReportPage() {
  const access = await requireAdvisorAccess();

  return (
    <AppShell
      title="Protection Report"
      subtitle="Household insurance and ILP coverage summary"
    >
      {access.allowed ? <ProtectionReportClient /> : <AdvisorAccessDenied />}
    </AppShell>
  );
}

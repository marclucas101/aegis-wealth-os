import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import PromotionsManagerClient from "@/components/aegis/advisor/promotions/PromotionsManagerClient";
import AppShell from "@/components/aegis/AppShell";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorPromotionsPage() {
  const access = await requireAdvisorAccess();

  return (
    <AppShell
      title="Promotions Manager"
      subtitle="Curate concise client opportunities, campaigns, and advisory highlights."
    >
      {access.allowed ? <PromotionsManagerClient /> : <AdvisorAccessDenied />}
    </AppShell>
  );
}

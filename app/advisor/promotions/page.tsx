import PromotionsManagerClient from "@/components/aegis/advisor/promotions/PromotionsManagerClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorPromotionsPage() {
  return (
    <AuthenticatedAppShell
      title="Promotions Manager"
      subtitle="Curate concise client opportunities, campaigns, and advisory highlights."
    >
      <PromotionsManagerClient />
    </AuthenticatedAppShell>
  );
}

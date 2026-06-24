import AdviserInsightsManagerClient from "@/components/aegis/advisor/insights/AdviserInsightsManagerClient";
import LegacyPromotionsRetiredNotice from "@/components/aegis/promotions/LegacyPromotionsRetiredNotice";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import { isLegacyPromotionsRetiredNoticeRequested } from "@/lib/promotions/legacyPromotionsRetirementConstants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdviserInsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showRetiredNotice = isLegacyPromotionsRetiredNoticeRequested(params);

  return (
    <AuthenticatedAppShell
      title="Insights Authoring"
      subtitle="Create governed educational content and adviser messages for your assigned clients."
    >
      {showRetiredNotice ? <LegacyPromotionsRetiredNotice audience="advisor" /> : null}
      <AdviserInsightsManagerClient />
    </AuthenticatedAppShell>
  );
}

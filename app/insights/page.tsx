import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import InsightsFeedClient from "@/components/aegis/client/InsightsFeedClient";
import ClientNotificationsPanel from "@/components/aegis/client/ClientNotificationsPanel";
import LegacyPromotionsRetiredNotice from "@/components/aegis/promotions/LegacyPromotionsRetiredNotice";
import { requireActiveClientPortalPage } from "@/lib/compliance/activeClientPageGate";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";
import { isLegacyPromotionsRetiredNoticeRequested } from "@/lib/promotions/legacyPromotionsRetirementConstants";

export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await cookies();
  await requireActiveClientPortalPage();
  const params = await searchParams;
  const showRetiredNotice = isLegacyPromotionsRetiredNoticeRequested(params);

  return (
    <AuthenticatedAppShell
      title={CLIENT_TERMINOLOGY.insightsAndUpdates}
      subtitle="Educational updates from your adviser"
    >
      {showRetiredNotice ? <LegacyPromotionsRetiredNotice audience="client" /> : null}
      <ClientNotificationsPanel />
      <InsightsFeedClient />
    </AuthenticatedAppShell>
  );
}

import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import InsightsFeedClient from "@/components/aegis/client/InsightsFeedClient";
import { requireActiveClientPortalPage } from "@/lib/compliance/activeClientPageGate";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  await cookies();
  await requireActiveClientPortalPage();

  return (
    <AuthenticatedAppShell
      title={CLIENT_TERMINOLOGY.insightsAndUpdates}
      subtitle="Educational updates from your adviser"
    >
      <InsightsFeedClient />
    </AuthenticatedAppShell>
  );
}

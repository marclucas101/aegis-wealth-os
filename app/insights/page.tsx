import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import InsightsPlaceholderClient from "@/components/aegis/client/InsightsPlaceholderClient";
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
      <InsightsPlaceholderClient />
    </AuthenticatedAppShell>
  );
}

import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import GoalsReviewsClient from "@/components/aegis/client/GoalsReviewsClient";
import { requireActiveClientPortalPage } from "@/lib/compliance/activeClientPageGate";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export const dynamic = "force-dynamic";

export default async function GoalsReviewsPage() {
  await cookies();
  await requireActiveClientPortalPage();

  return (
    <AuthenticatedAppShell
      title={CLIENT_TERMINOLOGY.goalsAndReviews}
      subtitle="Goals, life updates and review preparation"
    >
      <GoalsReviewsClient />
    </AuthenticatedAppShell>
  );
}

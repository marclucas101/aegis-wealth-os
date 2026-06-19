import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import GoalsReviewsClient from "@/components/aegis/client/GoalsReviewsClient";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export const dynamic = "force-dynamic";

export default async function GoalsReviewsPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title={CLIENT_TERMINOLOGY.goalsAndReviews}
      subtitle="Goals, life updates and review preparation"
    >
      <GoalsReviewsClient />
    </AuthenticatedAppShell>
  );
}

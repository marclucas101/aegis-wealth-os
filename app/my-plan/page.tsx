import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import MyPlanClient from "@/components/aegis/client/MyPlanClient";
import { requireActiveClientPortalPage } from "@/lib/compliance/activeClientPageGate";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export const dynamic = "force-dynamic";

export default async function MyPlanPage() {
  await cookies();
  await requireActiveClientPortalPage();

  return (
    <AuthenticatedAppShell
      title={CLIENT_TERMINOLOGY.myPlan}
      subtitle={CLIENT_TERMINOLOGY.adviserReviewedSummary}
    >
      <MyPlanClient />
    </AuthenticatedAppShell>
  );
}

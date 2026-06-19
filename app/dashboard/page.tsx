import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ActiveClientFinancialOverviewClient from "@/components/aegis/client/ActiveClientFinancialOverviewClient";
import DashboardClient from "@/components/aegis/DashboardClient";
import { getUserExperienceContext } from "@/lib/compliance/entitlements";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  await cookies();

  const session = await ensureUserClientProfile();
  const isActiveClient =
    session.authenticated &&
    session.user.role === "client" &&
    (await getUserExperienceContext({
      user: session.user,
      client: session.client,
    })).isActiveClient;

  return (
    <AuthenticatedAppShell
      title={isActiveClient ? CLIENT_TERMINOLOGY.financialOverview : "My Snapshot"}
      subtitle={
        isActiveClient
          ? "Your adviser-reviewed financial overview"
          : "Your adviser-reviewed financial readiness overview"
      }
    >
      {isActiveClient ? (
        <ActiveClientFinancialOverviewClient />
      ) : (
        <DashboardClient />
      )}
    </AuthenticatedAppShell>
  );
}

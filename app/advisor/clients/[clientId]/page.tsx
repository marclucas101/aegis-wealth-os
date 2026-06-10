import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AdvisorClientWorkspace from "@/components/aegis/advisor/AdvisorClientWorkspace";
import AppShell from "@/components/aegis/AppShell";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

type AdvisorClientPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function AdvisorClientPage({
  params,
}: AdvisorClientPageProps) {
  const access = await requireAdvisorAccess();
  const { clientId } = await params;

  return (
    <AppShell
      title="Client Workspace"
      subtitle="Read-only intelligence view for assigned client oversight"
    >
      {access.allowed ? (
        <AdvisorClientWorkspace clientId={clientId} />
      ) : (
        <AdvisorAccessDenied />
      )}
    </AppShell>
  );
}

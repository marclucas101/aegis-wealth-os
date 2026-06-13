import AdvisorClientWorkspace from "@/components/aegis/advisor/AdvisorClientWorkspace";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdvisorClientPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function AdvisorClientPage({
  params,
}: AdvisorClientPageProps) {
  const { clientId } = await params;

  return (
    <AuthenticatedAppShell
      title="Client File"
      subtitle="Institutional client intelligence, servicing workflow, and advisory oversight"
    >
      <AdvisorClientWorkspace clientId={clientId} />
    </AuthenticatedAppShell>
  );
}

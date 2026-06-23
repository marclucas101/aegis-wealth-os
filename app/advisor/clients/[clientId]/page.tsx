import AdvisorClientWorkspace from "@/components/aegis/advisor/AdvisorClientWorkspace";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdvisorClientPageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string; returnTab?: string }>;
};

export default async function AdvisorClientPage({
  params,
  searchParams,
}: AdvisorClientPageProps) {
  const { clientId } = await params;
  const query = await searchParams;
  const initialTab = query.returnTab ?? query.tab;

  return (
    <AuthenticatedAppShell
      title="Client File"
      subtitle="Institutional client intelligence, servicing workflow, and advisory oversight"
    >
      <AdvisorClientWorkspace
        key={`${clientId}-${initialTab ?? "overview"}`}
        clientId={clientId}
        initialTab={initialTab}
      />
    </AuthenticatedAppShell>
  );
}

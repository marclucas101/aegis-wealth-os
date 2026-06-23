import AdvisorPlanningOutputsClient from "@/components/aegis/advisor/AdvisorPlanningOutputsClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlanningOutputsPageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ focus?: string; returnTab?: string }>;
};

export default async function AdvisorPlanningOutputsPage({
  params,
  searchParams,
}: PlanningOutputsPageProps) {
  const { clientId } = await params;
  const query = await searchParams;

  return (
    <AuthenticatedAppShell
      title="Planning outputs"
      subtitle="Prepare, review, and publish client-safe planning content"
    >
      <AdvisorPlanningOutputsClient
        clientId={clientId}
        focus={query.focus}
        returnTab={query.returnTab ?? "meeting-packs"}
      />
    </AuthenticatedAppShell>
  );
}

import AdvisorClientRoadmapEditor from "@/components/aegis/advisor/AdvisorClientRoadmapEditor";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RoadmapPageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ returnTab?: string }>;
};

export default async function AdvisorClientRoadmapPage({
  params,
  searchParams,
}: RoadmapPageProps) {
  const { clientId } = await params;
  const query = await searchParams;

  return (
    <AuthenticatedAppShell
      title="Roadmap actions"
      subtitle="Prepare client-visible actions for the wealth roadmap output"
    >
      <AdvisorClientRoadmapEditor
        clientId={clientId}
        returnTab={query.returnTab ?? "meeting-packs"}
      />
    </AuthenticatedAppShell>
  );
}

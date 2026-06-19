import MeetingStudioClient from "@/components/aegis/advisor/meeting-studio/MeetingStudioClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MeetingStudioPageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ sessionId?: string; stage?: string }>;
};

export default async function MeetingStudioPage({
  params,
  searchParams,
}: MeetingStudioPageProps) {
  const { clientId } = await params;
  const { sessionId, stage } = await searchParams;

  const initialStage =
    stage === "present" || stage === "close" ? stage : "prepare";

  return (
    <AuthenticatedAppShell
      title="Meeting Studio"
      subtitle="Prepare, present, and close adviser-led client meetings"
    >
      <MeetingStudioClient
        clientId={clientId}
        initialSessionId={sessionId}
        initialStage={initialStage}
      />
    </AuthenticatedAppShell>
  );
}

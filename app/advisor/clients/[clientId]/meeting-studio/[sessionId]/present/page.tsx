import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PresentPageProps = {
  params: Promise<{ clientId: string; sessionId: string }>;
};

/** Dedicated presentation route — redirects into Meeting Studio present mode. */
export default async function MeetingPresentPage({ params }: PresentPageProps) {
  const { clientId, sessionId } = await params;
  redirect(
    `/advisor/clients/${clientId}/meeting-studio?sessionId=${sessionId}&stage=present`,
  );
}

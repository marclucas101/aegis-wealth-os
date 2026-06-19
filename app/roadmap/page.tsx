import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import RoadmapClient from "@/components/aegis/roadmap/RoadmapClient";
import { requireClientFeaturePage } from "@/lib/compliance/activeClientPageGate";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoadmapPage() {
  await cookies();
  await requireClientFeaturePage("roadmap");

  return (
    <AuthenticatedAppShell
      title="Roadmap™"
      subtitle="Turn gaps into clear, trackable actions"
    >
      <RoadmapClient />
    </AuthenticatedAppShell>
  );
}

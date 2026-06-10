import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import RoadmapClient from "@/components/aegis/roadmap/RoadmapClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoadmapPage() {
  await cookies();

  return (
    <AppShell
      title="Roadmap™"
      subtitle="Turn gaps into clear, trackable actions"
    >
      <RoadmapClient />
    </AppShell>
  );
}

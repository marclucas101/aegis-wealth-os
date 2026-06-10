import AppShell from "@/components/aegis/AppShell";
import RoadmapClient from "@/components/aegis/roadmap/RoadmapClient";

export default function RoadmapPage() {
  return (
    <AppShell
      title="Roadmap™"
      subtitle="Turn gaps into clear, trackable actions"
    >
      <RoadmapClient />
    </AppShell>
  );
}

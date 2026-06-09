import AppShell from "@/components/aegis/AppShell";
import RoadmapClient from "@/components/aegis/roadmap/RoadmapClient";

export default function RoadmapPage() {
  return (
    <AppShell
      title="Roadmap™"
      subtitle="Priority actions · Wealth architecture progression"
    >
      <RoadmapClient />
    </AppShell>
  );
}

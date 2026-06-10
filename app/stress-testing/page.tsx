import AppShell from "@/components/aegis/AppShell";
import StressTestingClient from "@/components/aegis/stress/StressTestingClient";

export default function StressTestingPage() {
  return (
    <AppShell
      title="Stress Testing™"
      subtitle="See how your plan handles life's what-ifs"
    >
      <StressTestingClient />
    </AppShell>
  );
}

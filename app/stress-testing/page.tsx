import AppShell from "@/components/aegis/AppShell";
import StressTestingClient from "@/components/aegis/stress/StressTestingClient";

export default function StressTestingPage() {
  return (
    <AppShell
      title="Stress Testing™"
      subtitle="Scenario simulations · Shield absorption analysis"
    >
      <StressTestingClient />
    </AppShell>
  );
}

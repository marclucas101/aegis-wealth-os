import AdvisorDashboardClient from "@/components/aegis/advisor/AdvisorDashboardClient";
import AppShell from "@/components/aegis/AppShell";

export default function AdvisorPage() {
  return (
    <AppShell
      title="Advisor Console"
      subtitle="Multi-client command centre for Shield Score monitoring and advisory follow-up"
    >
      <AdvisorDashboardClient />
    </AppShell>
  );
}

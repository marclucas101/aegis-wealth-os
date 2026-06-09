import AppShell from "@/components/aegis/AppShell";
import DashboardClient from "@/components/aegis/DashboardClient";

export default function DashboardPage() {
  return (
    <AppShell
      title="Shield Dashboard"
      subtitle="Strategic Intelligence. Generational Wealth."
    >
      <DashboardClient />
    </AppShell>
  );
}

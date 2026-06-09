import AppShell from "@/components/aegis/AppShell";
import ModulePlaceholder from "@/components/aegis/ModulePlaceholder";

export default function AdvisorPage() {
  return (
    <AppShell
      title="Advisor OS"
      subtitle="Client monitoring"
    >
      <ModulePlaceholder
        moduleName="Advisor Operating System™"
        description="Institutional client monitoring for wealth architecture advisors. Manage shield health, risk gaps, review cycles, and priority actions — focused on strengthening client architecture, not product sales."
        phase="Phase 7"
        features={[
          "Client overview with Shield Score, rating, and priority level",
          "Shield and risk monitoring with main gap identification",
          "Review reminders, pipeline tracking, and task management",
          "Document vault access and priority alert notifications",
          "Next best action recommendations tied to architecture roadmap",
        ]}
      />
    </AppShell>
  );
}

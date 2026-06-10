import AppShell from "@/components/aegis/AppShell";
import ShieldDiagnosticClient from "@/components/aegis/shield/ShieldDiagnosticClient";

export default function ShieldDiagnosticPage() {
  return (
    <AppShell
      title="Shield Diagnostic™"
      subtitle="How strong is your financial shield?"
    >
      <ShieldDiagnosticClient />
    </AppShell>
  );
}

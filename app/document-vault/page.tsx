import AppShell from "@/components/aegis/AppShell";
import ModulePlaceholder from "@/components/aegis/ModulePlaceholder";

export default function DocumentVaultPage() {
  return (
    <AppShell subtitle="Architecture records">
      <ModulePlaceholder
        moduleName="Document Vault™"
        description="Secure repository for the documents that underpin your wealth architecture. Centralise policies, estate instruments, financial statements, and governance records in one institutional-grade vault."
        phase="Phase 6"
        features={[
          "Insurance policies, wills, trusts, and estate documents",
          "CPF information, investment statements, and financial records",
          "Business ownership and succession planning documents",
          "Categorised storage linked to shield pillars and roadmap actions",
          "Advisor-accessible records with audit trail and review reminders",
        ]}
      />
    </AppShell>
  );
}

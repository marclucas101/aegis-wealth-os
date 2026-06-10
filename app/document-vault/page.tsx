import AppShell from "@/components/aegis/AppShell";
import DocumentVaultClient from "@/components/aegis/documents/DocumentVaultClient";

export default function DocumentVaultPage() {
  return (
    <AppShell
      title="Document Vault™"
      subtitle="Secure storage for your financial records"
    >
      <DocumentVaultClient />
    </AppShell>
  );
}

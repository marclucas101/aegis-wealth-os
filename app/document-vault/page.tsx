import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import DocumentVaultClient from "@/components/aegis/documents/DocumentVaultClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentVaultPage() {
  await cookies();

  return (
    <AppShell
      title="Document Vault™"
      subtitle="Secure storage for your financial records"
    >
      <DocumentVaultClient />
    </AppShell>
  );
}

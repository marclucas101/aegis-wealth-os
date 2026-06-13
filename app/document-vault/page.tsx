import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import DocumentVaultClient from "@/components/aegis/documents/DocumentVaultClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentVaultPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Document Vault™"
      subtitle="Secure storage for your financial records"
    >
      <DocumentVaultClient />
    </AuthenticatedAppShell>
  );
}

import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ShieldDiagnosticClient from "@/components/aegis/shield/ShieldDiagnosticClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShieldDiagnosticPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Shield Diagnostic™"
      subtitle="How strong is your financial shield?"
    >
      <ShieldDiagnosticClient />
    </AuthenticatedAppShell>
  );
}

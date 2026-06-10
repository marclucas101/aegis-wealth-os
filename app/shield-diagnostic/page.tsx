import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import ShieldDiagnosticClient from "@/components/aegis/shield/ShieldDiagnosticClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShieldDiagnosticPage() {
  await cookies();

  return (
    <AppShell
      title="Shield Diagnostic™"
      subtitle="How strong is your financial shield?"
    >
      <ShieldDiagnosticClient />
    </AppShell>
  );
}

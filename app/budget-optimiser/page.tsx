import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import BudgetOptimiserClient from "@/components/aegis/budget-optimiser/BudgetOptimiserClient";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BudgetOptimiserPage() {
  await cookies();

  return (
    <AppShell
      title="Budget Allocation Optimiser"
      subtitle="Analyse monthly spending against life-stage benchmarks and identify allocation drift."
    >
      <BudgetOptimiserClient />

      <div className="mt-8">
        <ClientTrustNotice variant="compact" context="general" />
      </div>
    </AppShell>
  );
}

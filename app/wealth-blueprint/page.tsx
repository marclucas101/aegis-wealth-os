import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import WealthBlueprintClient from "@/components/aegis/blueprint/WealthBlueprintClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WealthBlueprintPage() {
  await cookies();

  return (
    <AppShell
      title="Wealth Blueprint™"
      subtitle="Your personal planning report"
    >
      <WealthBlueprintClient />
    </AppShell>
  );
}

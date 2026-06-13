import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import WealthBlueprintClient from "@/components/aegis/blueprint/WealthBlueprintClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WealthBlueprintPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Wealth Blueprint™"
      subtitle="Your personal planning report"
    >
      <WealthBlueprintClient />
    </AuthenticatedAppShell>
  );
}

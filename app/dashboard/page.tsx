import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import DashboardClient from "@/components/aegis/DashboardClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Shield Dashboard"
      subtitle="Your financial shield, clearly explained"
    >
      <DashboardClient />
    </AuthenticatedAppShell>
  );
}

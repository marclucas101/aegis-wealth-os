import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import DashboardClient from "@/components/aegis/DashboardClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  await cookies();

  return (
    <AppShell
      title="Shield Dashboard"
      subtitle="Your financial shield, clearly explained"
    >
      <DashboardClient />
    </AppShell>
  );
}

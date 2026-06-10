import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import StressTestingClient from "@/components/aegis/stress/StressTestingClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StressTestingPage() {
  await cookies();

  return (
    <AppShell
      title="Stress Testing™"
      subtitle="See how your plan handles life's what-ifs"
    >
      <StressTestingClient />
    </AppShell>
  );
}

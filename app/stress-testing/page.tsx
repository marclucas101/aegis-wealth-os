import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import StressTestingClient from "@/components/aegis/stress/StressTestingClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StressTestingPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Stress Testing™"
      subtitle="See how your plan handles life's what-ifs"
    >
      <StressTestingClient />
    </AuthenticatedAppShell>
  );
}

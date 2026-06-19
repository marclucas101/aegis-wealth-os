import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ProspectHomeClient from "@/components/aegis/prospect/ProspectHomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProspectHomePage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Home"
      subtitle="Your adviser-led planning journey"
    >
      <ProspectHomeClient />
    </AuthenticatedAppShell>
  );
}

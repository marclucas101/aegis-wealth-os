import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import MeetingPreparationClient from "@/components/aegis/prospect/MeetingPreparationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MeetingPreparationPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Prepare for My Meeting"
      subtitle="Checklist and guidance for your advisory appointment"
    >
      <MeetingPreparationClient />
    </AuthenticatedAppShell>
  );
}

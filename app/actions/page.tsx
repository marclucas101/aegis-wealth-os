import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ClientActionsClient from "@/components/aegis/client/ClientActionsClient";
import { assertCrmV2ClientServiceAccess } from "@/lib/crm-v2/access";
import { listClientActions } from "@/lib/crm-v2/service/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientActionsPage() {
  await cookies();
  const access = await assertCrmV2ClientServiceAccess();
  const actions = access.allowed ? await listClientActions(access.client.id) : [];

  return (
    <AuthenticatedAppShell
      title="Actions"
      subtitle="Commitments and documents assigned to you"
    >
      {!access.allowed ? (
        <p className="text-sm text-[#F3F1EA]/70">Actions are currently unavailable.</p>
      ) : (
        <ClientActionsClient initialActions={actions} />
      )}
    </AuthenticatedAppShell>
  );
}

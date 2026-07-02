import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ClientRequestsClient from "@/components/aegis/client/ClientRequestsClient";
import { assertCrmV2ClientServiceAccess } from "@/lib/crm-v2/access";
import { listClientServiceRequests } from "@/lib/crm-v2/service/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientRequestsPage() {
  await cookies();
  const access = await assertCrmV2ClientServiceAccess();
  const requests = access.allowed
    ? await listClientServiceRequests(access.client.id)
    : [];

  return (
    <AuthenticatedAppShell
      title="Service requests"
      subtitle="Ask your adviser for help with documents, appointments and account updates"
    >
      {!access.allowed ? (
        <p className="text-sm text-[#F3F1EA]/70">Service requests are currently unavailable.</p>
      ) : (
        <ClientRequestsClient initialRequests={requests} />
      )}
    </AuthenticatedAppShell>
  );
}

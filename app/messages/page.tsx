import { ClientMessagesClient } from "@/components/aegis/client/ClientMessagesClient";
import { assertCrmV2ClientMessagesAccess } from "@/lib/crm-v2/access";
import { loadClientMessages } from "@/lib/crm-v2/communications/communications";

export default async function ClientMessagesPage() {
  const access = await assertCrmV2ClientMessagesAccess();
  if (!access.allowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>
        <p className="mt-2 text-sm text-slate-600">
          {access.reason === "feature_disabled"
            ? "Client messages are not enabled."
            : "Please sign in to view your messages."}
        </p>
      </div>
    );
  }

  const inbox = await loadClientMessages({ clientId: access.client.id });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <ClientMessagesClient initialInbox={inbox} loadError={null} />
    </div>
  );
}

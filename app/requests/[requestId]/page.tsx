import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import { assertCrmV2ClientServiceAccess } from "@/lib/crm-v2/access";
import { getClientServiceRequest } from "@/lib/crm-v2/service/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await cookies();
  const access = await assertCrmV2ClientServiceAccess();
  if (!access.allowed) {
    return (
      <AuthenticatedAppShell title="Request" subtitle="Service request detail">
        <p className="text-sm text-[#F3F1EA]/70">Service requests are currently unavailable.</p>
      </AuthenticatedAppShell>
    );
  }

  const { requestId } = await params;
  const result = await getClientServiceRequest(access.client.id, requestId);
  if (!result.ok) notFound();

  const { request, events } = result.data;

  return (
    <AuthenticatedAppShell title="Request detail" subtitle={request.categoryLabel}>
      <div className="space-y-6">
        <Link href="/requests" className="text-sm text-[#C9A227] hover:underline">
          ← Back to requests
        </Link>
        <section>
          <h2 className="text-lg font-semibold text-[#F3F1EA]">{request.summary}</h2>
          <p className="mt-2 text-sm text-[#F3F1EA]/70">Status: {request.clientVisibleStatus}</p>
          {request.details ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-[#F3F1EA]/80">{request.details}</p>
          ) : null}
          {request.resolutionSummary ? (
            <div className="mt-4 rounded-md border border-[#C9A227]/30 bg-[#1A2332]/60 p-4">
              <p className="text-sm font-medium text-[#C9A227]">Resolution</p>
              <p className="mt-1 text-sm text-[#F3F1EA]/80">{request.resolutionSummary}</p>
            </div>
          ) : null}
        </section>
        <section aria-labelledby="history-heading">
          <h3 id="history-heading" className="text-sm font-semibold text-[#F3F1EA]">
            History
          </h3>
          <ul className="mt-2 space-y-2" role="list">
            {events.map((event) => (
              <li key={event.eventId} className="text-sm text-[#F3F1EA]/70">
                {event.eventType.replace(/_/g, " ")} —{" "}
                {new Date(event.occurredAt).toLocaleString("en-SG")}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AuthenticatedAppShell>
  );
}

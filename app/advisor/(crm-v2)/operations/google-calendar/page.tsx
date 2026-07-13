import { redirect } from "next/navigation";

import { assertCrmV2OperationsAccess } from "@/lib/crm-v2/access";
import { loadGoogleCalendarIntegrationStatus } from "@/lib/crm-v2/google-calendar/service";
import { CRM_V2_OPERATIONS_PATH } from "@/lib/crm-v2/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorOperationsGoogleCalendarPage() {
  const access = await assertCrmV2OperationsAccess();
  if (!access.allowed) {
    redirect(CRM_V2_OPERATIONS_PATH);
  }

  const status = await loadGoogleCalendarIntegrationStatus(access.authUser.id);
  return (
    <div className="space-y-4 rounded-xl border border-[#D1A866]/14 bg-[#10283A]/40 p-4">
      <h1 className="text-xl font-light text-[#F3F1EA]">Google Calendar Operations</h1>
      <p className="text-sm font-light text-[#F3F1EA]/55">
        Safe operational telemetry for adviser calendar synchronization.
      </p>
      <ul className="space-y-1 text-sm text-[#F3F1EA]/75">
        <li>Connection state: {status.connection.connected ? "Connected" : "Not connected"}</li>
        <li>
          Selected calendar:{" "}
          {status.selectedCalendarEmail ?? status.selectedCalendarId ?? "Not selected"}
        </li>
        <li>Last successful sync: {status.lastSuccessfulSyncAt ?? "Never"}</li>
        <li>Pending sync count: {status.pendingSyncCount}</li>
        <li>Failed sync count: {status.failedSyncCount}</li>
        <li>Action required count: {status.actionRequiredCount}</li>
      </ul>
    </div>
  );
}

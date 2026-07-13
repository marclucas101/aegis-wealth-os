import { redirect } from "next/navigation";

import { assertCrmV2OperationsAccess } from "@/lib/crm-v2/access";
import { loadGoogleCalendarIntegrationStatus } from "@/lib/crm-v2/google-calendar/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorV2OperationsGoogleCalendarPage() {
  const access = await assertCrmV2OperationsAccess();
  if (!access.allowed) {
    redirect("/advisor-v2/operations");
  }

  const status = await loadGoogleCalendarIntegrationStatus(access.authUser.id);
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <h1 className="text-xl font-semibold text-slate-900">Google Calendar Operations</h1>
      <p className="text-sm text-slate-700">Safe operational telemetry for adviser calendar synchronization.</p>
      <ul className="space-y-1 text-sm text-slate-800">
        <li>Connection state: {status.connection.connected ? "Connected" : "Not connected"}</li>
        <li>Selected calendar: {status.selectedCalendarEmail ?? status.selectedCalendarId ?? "Not selected"}</li>
        <li>Last successful sync: {status.lastSuccessfulSyncAt ?? "Never"}</li>
        <li>Pending sync count: {status.pendingSyncCount}</li>
        <li>Failed sync count: {status.failedSyncCount}</li>
        <li>Action required count: {status.actionRequiredCount}</li>
      </ul>
    </div>
  );
}

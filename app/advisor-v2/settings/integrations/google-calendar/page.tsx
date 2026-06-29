import { redirect } from "next/navigation";

import GoogleCalendarIntegrationClient from "@/components/aegis/advisor-v2/google-calendar/GoogleCalendarIntegrationClient";
import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { loadGoogleCalendarIntegrationStatus } from "@/lib/crm-v2/google-calendar/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorV2GoogleCalendarIntegrationPage() {
  const access = await assertCrmV2GoogleCalendarAccess();
  if (!access.allowed) {
    redirect("/advisor-v2/settings");
  }

  const status = await loadGoogleCalendarIntegrationStatus(access.authUser.id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Google Calendar</h1>
      <GoogleCalendarIntegrationClient initialStatus={status} />
    </div>
  );
}

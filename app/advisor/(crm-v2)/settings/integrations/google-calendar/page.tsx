import { redirect } from "next/navigation";

import GoogleCalendarIntegrationClient from "@/components/aegis/advisor-v2/google-calendar/GoogleCalendarIntegrationClient";
import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { loadGoogleCalendarIntegrationStatus } from "@/lib/crm-v2/google-calendar/service";
import { CRM_V2_SETTINGS_PATH } from "@/lib/crm-v2/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorGoogleCalendarIntegrationPage() {
  const access = await assertCrmV2GoogleCalendarAccess();
  if (!access.allowed) {
    redirect(CRM_V2_SETTINGS_PATH);
  }

  const status = await loadGoogleCalendarIntegrationStatus(access.authUser.id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-light text-[#F3F1EA]">Google Calendar</h1>
      <GoogleCalendarIntegrationClient initialStatus={status} />
    </div>
  );
}

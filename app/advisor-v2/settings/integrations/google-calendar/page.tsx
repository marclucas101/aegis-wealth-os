import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserV2GoogleCalendarSettingsAliasPage() {
  redirectToCanonicalAdviserRoute(CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH);
}

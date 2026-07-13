import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_SETTINGS_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserV2SettingsAliasPage() {
  redirectToCanonicalAdviserRoute(CRM_V2_SETTINGS_PATH);
}

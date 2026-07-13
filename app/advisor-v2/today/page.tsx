import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_TODAY_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserV2TodayAliasPage() {
  redirectToCanonicalAdviserRoute(CRM_V2_TODAY_PATH);
}

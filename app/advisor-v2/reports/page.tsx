import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_REPORTS_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserV2ReportsAliasPage() {
  redirectToCanonicalAdviserRoute(CRM_V2_REPORTS_PATH);
}

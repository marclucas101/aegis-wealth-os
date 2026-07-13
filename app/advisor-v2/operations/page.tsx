import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_OPERATIONS_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserV2OperationsAliasPage() {
  redirectToCanonicalAdviserRoute(CRM_V2_OPERATIONS_PATH);
}

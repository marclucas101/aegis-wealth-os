import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_TEMPLATES_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserV2TemplatesAliasPage() {
  redirectToCanonicalAdviserRoute(CRM_V2_TEMPLATES_PATH);
}

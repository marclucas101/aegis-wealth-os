import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_RELATIONSHIPS_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserV2RelationshipsAliasPage() {
  redirectToCanonicalAdviserRoute(CRM_V2_RELATIONSHIPS_PATH);
}

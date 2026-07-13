import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_SERVICE_PATH } from "@/lib/crm-v2/navigation";

export default async function AdviserV2ServiceAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  redirectToCanonicalAdviserRoute(CRM_V2_SERVICE_PATH, await searchParams);
}

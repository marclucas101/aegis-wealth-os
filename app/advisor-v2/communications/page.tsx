import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_COMMUNICATIONS_PATH } from "@/lib/crm-v2/navigation";

export default async function AdviserV2CommunicationsAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirectToCanonicalAdviserRoute(CRM_V2_COMMUNICATIONS_PATH, await searchParams);
}

import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_APPOINTMENTS_PATH } from "@/lib/crm-v2/navigation";

export default async function AdviserV2AppointmentsAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  redirectToCanonicalAdviserRoute(CRM_V2_APPOINTMENTS_PATH, await searchParams);
}

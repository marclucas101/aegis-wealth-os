import { redirectToCanonicalAdviserRoute } from "@/lib/crm-v2/aliasRedirects";
import { CRM_V2_APPOINTMENTS_PATH } from "@/lib/crm-v2/navigation";

export default async function AdviserV2NewAppointmentAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ relationshipId?: string }>;
}) {
  redirectToCanonicalAdviserRoute(
    `${CRM_V2_APPOINTMENTS_PATH}/new`,
    await searchParams,
  );
}

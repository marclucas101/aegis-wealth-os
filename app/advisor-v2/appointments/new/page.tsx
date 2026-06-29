import AppointmentNewClient from "@/components/aegis/advisor-v2/appointments/AppointmentNewClient";
import CrmV2AccessDenied from "@/components/aegis/advisor-v2/CrmV2AccessDenied";
import { assertCrmV2AppointmentsAccess } from "@/lib/crm-v2/access";
import { loadAssignedRelationshipsForAppointments } from "@/lib/crm-v2/appointments/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CrmV2NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ relationshipId?: string }>;
}) {
  const access = await assertCrmV2AppointmentsAccess();
  if (!access.allowed) {
    return <CrmV2AccessDenied />;
  }

  const params = await searchParams;
  const relationships = await loadAssignedRelationshipsForAppointments(
    access.authUser.id,
    access.user.role as "advisor" | "admin",
  );

  return (
    <AppointmentNewClient
      relationships={relationships}
      initialRelationshipId={params.relationshipId}
    />
  );
}

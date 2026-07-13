import AppointmentNewClient from "@/components/aegis/advisor-v2/appointments/AppointmentNewClient";
import CrmV2ModuleUnavailablePage from "@/components/aegis/advisor-v2/CrmV2ModuleUnavailablePage";
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
    return (
      <CrmV2ModuleUnavailablePage
        title="New appointment"
        reason={access.reason}
        nextStep="Return to Appointments when the module is enabled for your workspace."
      />
    );
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

import AppointmentListClient from "@/components/aegis/advisor-v2/appointments/AppointmentListClient";
import CrmV2ModuleUnavailablePage from "@/components/aegis/advisor-v2/CrmV2ModuleUnavailablePage";
import { assertCrmV2AppointmentsAccess } from "@/lib/crm-v2/access";import { loadCrmAppointmentListPage } from "@/lib/crm-v2/appointments/listQueries";
import { parseAppointmentListView } from "@/lib/crm-v2/appointments/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CrmV2AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const access = await assertCrmV2AppointmentsAccess();
  if (!access.allowed) {
    return (
      <CrmV2ModuleUnavailablePage
        title="Appointments"
        reason={access.reason}
        nextStep="When enabled, schedule from Relationships or use New appointment to book the next client meeting."
      />
    );
  }
  const params = await searchParams;
  const view = parseAppointmentListView(params.view ?? null);
  const now = new Date().toISOString();

  const initialPage = await loadCrmAppointmentListPage(
    access.authUser.id,
    access.user.role as "advisor" | "admin",
    { view, page: 1, pageSize: 20, now },
  );

  return <AppointmentListClient initialPage={initialPage} />;
}

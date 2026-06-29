import AppointmentDetailClient from "@/components/aegis/advisor-v2/appointments/AppointmentDetailClient";
import CrmV2AccessDenied from "@/components/aegis/advisor-v2/CrmV2AccessDenied";
import { assertCrmV2AppointmentsAccess } from "@/lib/crm-v2/access";
import { loadCrmAppointmentDetail } from "@/lib/crm-v2/appointments/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CrmV2AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const access = await assertCrmV2AppointmentsAccess();
  if (!access.allowed) {
    return <CrmV2AccessDenied />;
  }

  const { appointmentId } = await params;
  const appointment = await loadCrmAppointmentDetail(
    access.authUser.id,
    access.user.role as "advisor" | "admin",
    appointmentId,
  );

  if (!appointment) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700">
        This appointment is unavailable.
      </div>
    );
  }

  return <AppointmentDetailClient initialAppointment={appointment} />;
}

import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ClientAppointmentDetail from "@/components/aegis/client/ClientAppointmentDetail";
import { assertCrmV2ClientAppointmentsAccess } from "@/lib/crm-v2/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  await cookies();
  const access = await assertCrmV2ClientAppointmentsAccess();
  const { appointmentId } = await params;
  return (
    <AuthenticatedAppShell
      title="Appointment detail"
      subtitle="Confirm proposals, complete preparation and review outcomes"
    >
      {!access.allowed ? (
        <p className="text-sm text-[#F3F1EA]/70">
          Appointment details are currently unavailable.
        </p>
      ) : (
        <ClientAppointmentDetail appointmentId={appointmentId} />
      )}
    </AuthenticatedAppShell>
  );
}

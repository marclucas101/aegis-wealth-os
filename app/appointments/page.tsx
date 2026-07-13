import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ClientAppointmentsDashboard from "@/components/aegis/client/ClientAppointmentsDashboard";
import { assertCrmV2ClientAppointmentsAccess } from "@/lib/crm-v2/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppointmentsPage() {
  await cookies();
  const access = await assertCrmV2ClientAppointmentsAccess();
  return (
    <AuthenticatedAppShell
      title="Appointments"
      subtitle="View your meetings and request time with your adviser"
    >
      {!access.allowed ? (
        <p className="text-sm text-[#F3F1EA]/70">
          Appointments are currently unavailable. Please contact your adviser if you need to schedule
          a meeting.
        </p>
      ) : (
        <ClientAppointmentsDashboard />
      )}
    </AuthenticatedAppShell>
  );
}

import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import ClientAppointmentRequestForm from "@/components/aegis/client/ClientAppointmentRequestForm";
import { assertCrmV2ClientAppointmentsAccess } from "@/lib/crm-v2/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppointmentsRequestPage() {
  await cookies();
  const access = await assertCrmV2ClientAppointmentsAccess();
  return (
    <AuthenticatedAppShell
      title="Request an appointment"
      subtitle="Share your preferred timing and what you would like to discuss"
    >
      {!access.allowed ? (
        <p className="text-sm text-[#F3F1EA]/70">
          Appointment requests are currently unavailable. Please contact your adviser to schedule a
          meeting.
        </p>
      ) : (
        <ClientAppointmentRequestForm />
      )}
    </AuthenticatedAppShell>
  );
}

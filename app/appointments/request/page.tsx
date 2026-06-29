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
      title="Request appointment"
      subtitle="Share your preferred schedule and discussion topics"
    >
      {!access.allowed ? (
        <p className="text-sm text-[#F3F1EA]/70">
          Appointment requests are currently unavailable.
        </p>
      ) : (
        <ClientAppointmentRequestForm />
      )}
    </AuthenticatedAppShell>
  );
}

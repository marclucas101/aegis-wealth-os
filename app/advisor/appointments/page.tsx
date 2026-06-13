import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import AppointmentsManagerClient from "@/components/aegis/advisor/appointments/AppointmentsManagerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdvisorAppointmentsPage() {
  return (
    <AuthenticatedAppShell
      title="Appointments"
      subtitle="Upcoming client bookings and calendar events"
    >
      <AppointmentsManagerClient />
    </AuthenticatedAppShell>
  );
}

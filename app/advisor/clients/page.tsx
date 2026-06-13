import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import MyClientsListClient from "@/components/aegis/advisor/MyClientsListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdvisorMyClientsPage() {
  return (
    <AuthenticatedAppShell
      title="My Clients"
      subtitle="Assigned client roster, servicing status, and workspace entry"
    >
      <MyClientsListClient />
    </AuthenticatedAppShell>
  );
}

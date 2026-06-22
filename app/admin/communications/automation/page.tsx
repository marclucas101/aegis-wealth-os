import AdminJobOperationsClient from "@/components/aegis/admin/AdminJobOperationsClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCommunicationsAutomationPage() {
  return (
    <AuthenticatedAppShell
      title="Scheduled Publishing"
      subtitle="Run and monitor automated scheduled-content publication jobs."
    >
      <AdminJobOperationsClient />
    </AuthenticatedAppShell>
  );
}

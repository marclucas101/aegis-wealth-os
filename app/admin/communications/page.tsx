import AdminCommunicationsClient from "@/components/aegis/admin/AdminCommunicationsClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCommunicationsPage() {
  return (
    <AuthenticatedAppShell
      title="Content Governance"
      subtitle="Review, approve and manage governed communications and Insights."
    >
      <AdminCommunicationsClient />
    </AuthenticatedAppShell>
  );
}

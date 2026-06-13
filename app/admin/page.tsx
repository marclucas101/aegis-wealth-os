import AdminDashboardClient from "@/components/aegis/admin/AdminDashboardClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  return (
    <AuthenticatedAppShell
      title="Admin Console"
      subtitle="Manage user roles and advisor–client assignments"
    >
      <AdminDashboardClient />
    </AuthenticatedAppShell>
  );
}

import AdminAccessDenied from "@/components/aegis/admin/AdminAccessDenied";
import AdminDashboardClient from "@/components/aegis/admin/AdminDashboardClient";
import AppShell from "@/components/aegis/AppShell";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";

export default async function AdminPage() {
  const access = await requireAdminAccess();

  return (
    <AppShell
      title="Admin Console"
      subtitle="Manage user roles and advisor–client assignments"
    >
      {access.allowed ? <AdminDashboardClient /> : <AdminAccessDenied />}
    </AppShell>
  );
}

import AdminAccessDenied from "@/components/aegis/admin/AdminAccessDenied";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAdminAccess();

  if (!access.allowed) {
    return (
      <AuthenticatedAppShell>
        <AdminAccessDenied />
      </AuthenticatedAppShell>
    );
  }

  return children;
}

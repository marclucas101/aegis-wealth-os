import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAdvisorAccess();

  if (!access.allowed) {
    return (
      <AuthenticatedAppShell>
        <AdvisorAccessDenied />
      </AuthenticatedAppShell>
    );
  }

  return children;
}

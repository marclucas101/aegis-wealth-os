import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import SupabaseHealthCheck from "@/components/aegis/SupabaseHealthCheck";

export default function SupabaseHealthPage() {
  return (
    <AuthenticatedAppShell
      title="Supabase Health"
      subtitle="Database connectivity"
    >
      <SupabaseHealthCheck />
    </AuthenticatedAppShell>
  );
}

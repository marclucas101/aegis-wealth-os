import AppShell from "@/components/aegis/AppShell";
import SupabaseHealthCheck from "@/components/aegis/SupabaseHealthCheck";

export default function SupabaseHealthPage() {
  return (
    <AppShell
      title="Supabase Health"
      subtitle="Database connectivity"
    >
      <SupabaseHealthCheck />
    </AppShell>
  );
}

import AdviserProfileSetupClient from "@/components/aegis/advisor/setup/AdviserProfileSetupClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdviserSetupPage() {
  return (
    <AuthenticatedAppShell
      title="Adviser Setup"
      subtitle="Manage your public adviser profile for client-facing pages"
    >
      <AdviserProfileSetupClient />
    </AuthenticatedAppShell>
  );
}

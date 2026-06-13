import ProtectionReportClient from "@/components/aegis/advisor/protection-report/ProtectionReportClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectionReportPage() {
  return (
    <AuthenticatedAppShell
      title="Protection Report"
      subtitle="Household insurance and ILP coverage summary"
    >
      <ProtectionReportClient />
    </AuthenticatedAppShell>
  );
}

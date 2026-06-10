import { notFound } from "next/navigation";

import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import { AdvisorAnnualReviewPrintView } from "@/components/aegis/advisor/AdvisorReportViewer";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { loadAdvisorAnnualReviewDetail } from "@/lib/supabase/advisorReportQueries";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{ clientId: string; reviewId: string }>;
  searchParams: Promise<{ print?: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }
  return null;
}

export default async function AdvisorAnnualReviewPrintPage({
  params,
  searchParams,
}: PageProps) {
  const access = await requireAdvisorAccess();

  if (!access.allowed) {
    return <AdvisorAccessDenied />;
  }

  const role = advisorRole(access.user.role);
  if (!role) {
    return <AdvisorAccessDenied />;
  }

  const { clientId, reviewId } = await params;
  const { print } = await searchParams;

  const result = await loadAdvisorAnnualReviewDetail(
    access.authUser.id,
    role,
    clientId,
    reviewId,
  );

  if (!result.ok) {
    notFound();
  }

  const admin = createAdminSupabaseClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("display_name")
    .eq("id", clientId)
    .maybeSingle();

  const clientName =
    (clientRow as { display_name?: string } | null)?.display_name ?? "Client";

  return (
    <AdvisorAnnualReviewPrintView
      report={result.report}
      clientName={clientName}
      clientId={clientId}
      autoPrint={print === "1"}
    />
  );
}

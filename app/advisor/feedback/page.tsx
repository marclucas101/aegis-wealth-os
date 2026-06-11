import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AdvisorFeedbackReviewClient from "@/components/aegis/advisor/feedback/AdvisorFeedbackReviewClient";
import AppShell from "@/components/aegis/AppShell";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorFeedbackPage() {
  const access = await requireAdvisorAccess();

  return (
    <AppShell
      title="Client Feedback"
      subtitle="Review advisory experience ratings, quality signals, and testimonial-ready submissions."
    >
      {access.allowed ? <AdvisorFeedbackReviewClient /> : <AdvisorAccessDenied />}
    </AppShell>
  );
}

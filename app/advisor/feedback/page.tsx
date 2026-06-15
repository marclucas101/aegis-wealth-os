import AdvisorFeedbackReviewClient from "@/components/aegis/advisor/feedback/AdvisorFeedbackReviewClient";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";



export const dynamic = "force-dynamic";

export const revalidate = 0;



export default async function AdvisorFeedbackPage() {

  return (

    <AuthenticatedAppShell

      title="Client Feedback"

      subtitle="Review advisory experience ratings, quality signals, and testimonial-ready submissions."

    >

      <AdvisorFeedbackReviewClient />

    </AuthenticatedAppShell>

  );

}


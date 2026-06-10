"use client";

import ClientEmptyState from "@/components/aegis/client/ClientEmptyState";

export default function AnnualReviewEmptyState() {
  return (
    <ClientEmptyState
      eyebrow="Annual Shield Review"
      title="Your annual review unlocks after Discover"
      description="Once your profile is complete, your annual review shows how your Shield score could progress over four years — and what to focus on next."
      primaryHref="/discover"
      primaryLabel="Start Discover"
      steps={[
        "Complete Discover and review your Roadmap",
        "Mark roadmap progress as you go",
        "Return here for your year-ahead summary",
      ]}
    />
  );
}

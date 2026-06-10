"use client";

import ClientEmptyState from "@/components/aegis/client/ClientEmptyState";

export default function BlueprintEmptyState() {
  return (
    <ClientEmptyState
      eyebrow="Wealth Blueprint"
      title="Your report unlocks after Discover"
      description="The Wealth Blueprint brings your scores, pillar analysis, stress highlights, and roadmap into one readable report you can review with your advisor."
      primaryHref="/discover"
      primaryLabel="Start Discover"
      steps={[
        "Complete your Discover profile",
        "Review Shield Diagnostic and Roadmap",
        "Return here for your full Blueprint report",
      ]}
    />
  );
}

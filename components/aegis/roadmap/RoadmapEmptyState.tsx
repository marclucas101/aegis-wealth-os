"use client";

import ClientEmptyState from "@/components/aegis/client/ClientEmptyState";

export default function RoadmapEmptyState() {
  return (
    <ClientEmptyState
      eyebrow="Wealth Roadmap"
      title="Your roadmap unlocks after Discover"
      description="Once your profile is complete, we generate a prioritised list of actions — each with expected impact and a timeline you can track."
      primaryHref="/discover"
      primaryLabel="Start Discover"
      steps={[
        "Complete your Discover profile",
        "Review your Shield Diagnostic",
        "Return here for personalised actions",
      ]}
    />
  );
}

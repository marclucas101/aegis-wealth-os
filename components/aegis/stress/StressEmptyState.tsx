"use client";

import ClientEmptyState from "@/components/aegis/client/ClientEmptyState";

export default function StressEmptyState() {
  return (
    <ClientEmptyState
      eyebrow="Stress Testing"
      title="Complete Discover to run scenarios"
      description="Stress tests show how your plan holds up when life throws curveballs — job loss, illness, market drops, and more."
      primaryHref="/discover"
      primaryLabel="Start Discover"
      steps={[
        "Finish your Discover profile",
        "Choose a scenario and severity level",
        "See how your Shield score responds",
      ]}
    />
  );
}

"use client";

import ClientEmptyState from "@/components/aegis/client/ClientEmptyState";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";

interface DashboardEmptyStateProps {
  onViewDemo: () => void;
}

export default function DashboardEmptyState({
  onViewDemo,
}: DashboardEmptyStateProps) {
  return (
    <div className="space-y-6">
      <ClientEmptyState
        eyebrow="Shield Dashboard"
        title="Your dashboard unlocks after Discover"
        description="Complete a short financial profile so we can calculate your Shield score, highlight priority gaps, and show how you compare."
        primaryHref="/discover"
        primaryLabel="Start Discover"
        secondaryAction={{
          label: "Preview with demo data",
          onClick: onViewDemo,
        }}
        steps={[
          "Answer guided questions about your finances",
          "Review your Shield Diagnostic scores",
          "Return here for your full dashboard view",
        ]}
      />
      <ClientTrustNotice variant="compact" context="general" />
    </div>
  );
}

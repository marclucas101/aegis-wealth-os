"use client";

import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export default function InsightsPlaceholderClient() {
  return (
    <>
      <ClientPortalHeader
        eyebrow={CLIENT_TERMINOLOGY.insightsAndUpdates}
        title="Updates from your adviser"
        subtitle="Approved educational content and adviser communications will appear here."
      />

      <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-6 py-10 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/65">
          Updates from your adviser will appear here when available.
        </p>
        <p className="mt-3 text-xs text-[#F3F1EA]/40">
          General educational content requires adviser approval before publication. This
          platform does not provide personalised market commentary or recommendations.
        </p>
      </div>

      <div className="mt-8">
        <ClientTrustNotice />
      </div>
    </>
  );
}

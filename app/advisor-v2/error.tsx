"use client";

import Link from "next/link";

import RouteErrorFallback from "@/components/aegis/RouteErrorFallback";
import { CRM_V2_CLASSIC_ADVISER_PATH } from "@/lib/crm-v2/navigation";

export default function AdviserCrmV2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = error.digest ? `Reference: ${error.digest}` : undefined;

  console.error("[advisor-v2/error]", {
    digest: error.digest ?? null,
    name: error.name,
  });

  return (
    <div className="px-4 py-12">
      <RouteErrorFallback
        title="CRM V2 unavailable"
        message="We could not load this CRM V2 view. Your session remains active."
        reset={reset}
      />
      {reference ? (
        <p className="mt-4 text-center text-xs text-[#F3F1EA]/30">{reference}</p>
      ) : null}
      <div className="mt-4 text-center">
        <Link
          href={CRM_V2_CLASSIC_ADVISER_PATH}
          className="text-sm text-[#D1A866] hover:underline"
        >
          Return to classic adviser workspace
        </Link>
      </div>
    </div>
  );
}

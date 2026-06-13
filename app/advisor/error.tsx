"use client";

import Link from "next/link";

import RouteErrorFallback from "@/components/aegis/RouteErrorFallback";

export default function AdvisorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[advisor/error]", error);

  return (
    <div className="px-4 py-12">
      <RouteErrorFallback
        title="Adviser workspace unavailable"
        message="We could not load this adviser view. Your session remains active."
        reset={reset}
      />
      <div className="mt-4 text-center">
        <Link
          href="/advisor/clients"
          className="text-sm text-[#D1A866] hover:underline"
        >
          Return to My Clients
        </Link>
      </div>
    </div>
  );
}

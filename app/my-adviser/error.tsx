"use client";

import RouteErrorFallback from "@/components/aegis/RouteErrorFallback";

export default function MyAdviserError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[my-adviser/error]", error);

  return (
    <div className="px-4 py-12">
      <RouteErrorFallback
        title="My Adviser unavailable"
        message="We could not load your adviser page. Your session remains active."
        reset={reset}
      />
    </div>
  );
}

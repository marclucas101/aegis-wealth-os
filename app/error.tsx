"use client";

import RouteErrorFallback from "@/components/aegis/RouteErrorFallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[app/error]", error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071B2A] px-4 py-12">
      <RouteErrorFallback reset={reset} />
    </main>
  );
}

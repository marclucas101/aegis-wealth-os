"use client";

import Link from "next/link";

interface RouteErrorFallbackProps {
  title?: string;
  message?: string;
  reset?: () => void;
}

export default function RouteErrorFallback({
  title = "Something went wrong",
  message = "An unexpected error occurred. Your session is still active — try again or return to a safe page.",
  reset,
}: RouteErrorFallbackProps) {
  return (
    <div className="mx-auto max-w-lg rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-6 py-10 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/70">
        AEGIS
      </p>
      <h1 className="mt-3 text-xl font-light text-[#F3F1EA]">{title}</h1>
      <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
        {message}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {reset ? (
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-4 py-2 text-sm text-[#F3F1EA] hover:bg-[#D1A866]/18"
          >
            Try again
          </button>
        ) : null}
        <Link
          href="/dashboard"
          className="rounded-sm border border-[#F3F1EA]/15 px-4 py-2 text-sm text-[#F3F1EA]/70 hover:bg-[#071B2A]/50"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

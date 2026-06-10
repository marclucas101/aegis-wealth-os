import type { Metadata } from "next";
import Link from "next/link";

import AuthForm from "@/components/aegis/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign In",
};

function TriSpireMark() {
  return (
    <svg
      viewBox="0 0 80 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-14 w-11"
      aria-hidden
    >
      <path
        d="M12 90V28L40 6L68 28V90"
        stroke="#D1A866"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M24 90V48L40 32L56 48V90"
        stroke="#D1A866"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M40 6V90"
        stroke="#D1A866"
        strokeWidth="0.8"
        opacity="0.25"
      />
      <line
        x1="12"
        y1="90"
        x2="68"
        y2="90"
        stroke="#D1A866"
        strokeWidth="0.8"
        opacity="0.35"
      />
    </svg>
  );
}

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : undefined;

  const formError =
    params.error === "auth_callback_failed"
      ? "Email confirmation failed. Please try signing in again."
      : params.error === "missing_auth_code"
        ? "Authentication link was invalid. Please try again."
        : params.error
          ? params.error
          : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071B2A] text-[#F3F1EA]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1A2A2B_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#10283A_0%,_transparent_45%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-10 sm:px-8">
        <header className="flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-4 transition-opacity hover:opacity-90">
            <TriSpireMark />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#D1A866]">
                AEGIS
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
                Wealth Operating System™
              </p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/35 transition-colors hover:text-[#D1A866]/80"
          >
            Back to home
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-12 sm:py-16">
          <div className="w-full max-w-md">
            <AuthForm mode="login" next={next} initialError={formError} />
          </div>
        </main>
      </div>
    </div>
  );
}

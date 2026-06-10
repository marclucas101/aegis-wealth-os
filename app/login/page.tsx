import type { Metadata } from "next";
import Link from "next/link";

import BrandLogo from "@/components/brand/BrandLogo";
import AuthForm from "@/components/aegis/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign In",
};

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
          <Link href="/" className="transition-opacity hover:opacity-90">
            <BrandLogo variant="full" size="md" priority />
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

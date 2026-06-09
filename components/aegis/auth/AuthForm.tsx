"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  login,
  signup,
  type AuthFormState,
} from "@/app/auth/actions";

const initialState: AuthFormState = {
  error: null,
  success: null,
};

type AuthFormProps = {
  mode: "login" | "signup";
  next?: string;
};

export default function AuthForm({ mode, next }: AuthFormProps) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState(action, initialState);

  const title = mode === "login" ? "Sign In" : "Create Account";
  const subtitle =
    mode === "login"
      ? "Access your wealth architecture platform."
      : "Begin your institutional wealth architecture journey.";
  const submitLabel = mode === "login" ? "Sign In" : "Create Account";
  const alternateHref = mode === "login" ? "/signup" : "/login";
  const alternatePrompt =
    mode === "login" ? "New to AEGIS?" : "Already have an account?";
  const alternateLabel = mode === "login" ? "Create account" : "Sign in";

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/80">
          Secure Access
        </p>
        <h1 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">{subtitle}</p>
      </div>

      <form
        action={formAction}
        className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6 backdrop-blur-sm sm:p-8"
      >
        {next && mode === "login" ? (
          <input type="hidden" name="next" value={next} />
        ) : null}

        <div className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-[#F3F1EA]/40"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-4 py-3 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/40"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-[#F3F1EA]/40"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={8}
              className="w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-4 py-3 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/40"
              placeholder="Minimum 8 characters"
            />
          </div>
        </div>

        {state.error ? (
          <p
            role="alert"
            className="mt-5 rounded-sm border border-red-400/20 bg-red-950/30 px-4 py-3 text-sm text-red-300/90"
          >
            {state.error}
          </p>
        ) : null}

        {state.success ? (
          <p
            role="status"
            className="mt-5 rounded-sm border border-[#D1A866]/20 bg-[#D1A866]/8 px-4 py-3 text-sm text-[#D1A866]/90"
          >
            {state.success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3.5 text-sm font-light tracking-wide text-[#D1A866] transition-all hover:border-[#D1A866]/60 hover:bg-[#D1A866]/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Please wait…" : submitLabel}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#F3F1EA]/35">
        {alternatePrompt}{" "}
        <Link
          href={alternateHref}
          className="text-[#D1A866]/80 underline-offset-4 transition-colors hover:text-[#D1A866] hover:underline"
        >
          {alternateLabel}
        </Link>
      </p>
    </div>
  );
}

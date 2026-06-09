"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error: string | null;
  success: string | null;
};

const initialAuthState: AuthFormState = {
  error: null,
  success: null,
};

function readCredentials(formData: FormData): {
  email: string;
  password: string;
  error: string | null;
} {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { email, password, error: "Email and password are required." };
  }

  if (password.length < 8) {
    return {
      email,
      password,
      error: "Password must be at least 8 characters.",
    };
  }

  return { email, password, error: null };
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password, error: validationError } = readCredentials(formData);

  if (validationError) {
    return { ...initialAuthState, error: validationError };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ...initialAuthState, error: error.message };
  }

  const next = String(formData.get("next") ?? "").trim();
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password, error: validationError } = readCredentials(formData);

  if (validationError) {
    return { ...initialAuthState, error: validationError };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ...initialAuthState, error: error.message };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    error: null,
    success:
      "Account created. Check your email to confirm your address, then sign in.",
  };
}

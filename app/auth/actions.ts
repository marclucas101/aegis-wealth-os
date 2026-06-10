"use server";

import { cookies } from "next/headers";
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

function hasSupabaseAuthCookies(
  cookieList: { name: string; value: string }[],
): boolean {
  return cookieList.some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.value.length > 0,
  );
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

  const cookieStore = await cookies();
  if (!hasSupabaseAuthCookies(cookieStore.getAll())) {
    return {
      ...initialAuthState,
      error: "Sign-in succeeded but session cookies were not saved. Please try again.",
    };
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
    const cookieStore = await cookies();
    if (!hasSupabaseAuthCookies(cookieStore.getAll())) {
      return {
        ...initialAuthState,
        error: "Account created but session cookies were not saved. Please sign in.",
      };
    }

    redirect("/dashboard");
  }

  return {
    error: null,
    success:
      "Account created. Check your email to confirm your address, then sign in.",
  };
}

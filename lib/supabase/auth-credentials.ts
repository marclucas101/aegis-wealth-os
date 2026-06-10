export function readAuthCredentials(formData: FormData): {
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

export function hasSupabaseAuthCookies(
  cookieList: { name: string; value: string }[],
): boolean {
  return cookieList.some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.value.length > 0,
  );
}

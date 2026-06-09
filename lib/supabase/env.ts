function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

/**
 * Validates and returns public Supabase env vars safe for browser and server use.
 */
export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

/**
 * Validates and returns the service role key.
 * Server-only — import from admin.ts or other trusted server modules only.
 */
export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

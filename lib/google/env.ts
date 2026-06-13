import "server-only";

const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;

export function getGoogleClientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!value) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  return value;
}

export function getGoogleClientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!value) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  }

  return value;
}

export function getGoogleCalendarRedirectUri(requestOrigin?: string): string {
  const configured = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  if (requestOrigin) {
    return `${requestOrigin.replace(/\/$/, "")}/api/google-calendar/callback`;
  }

  throw new Error("GOOGLE_CALENDAR_REDIRECT_URI is not configured");
}

export function getGoogleOAuthStateSecret(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ||
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim() ||
    ""
  );
}

export function getGoogleCalendarScopes(): string[] {
  return [...GOOGLE_CALENDAR_SCOPES];
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      (process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.BASE_URL?.trim()) &&
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim(),
  );
}

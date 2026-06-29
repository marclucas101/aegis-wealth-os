/** IANA timezone validation without external dependencies. */
export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone || timezone.length > 64) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

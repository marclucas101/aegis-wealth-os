/**
 * Normalises a phone number into a safe `tel:` href.
 * Returns null when the number is missing or invalid.
 */
export function toTelHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  const stripped = trimmed.replace(/[\s()\-]/g, "");
  if (!stripped) {
    return null;
  }

  const normalized = stripped.startsWith("+")
    ? `+${stripped.slice(1).replace(/\D/g, "")}`
    : stripped.replace(/\D/g, "");

  const digitCount = normalized.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) {
    return null;
  }

  if (!/^\+?\d{7,15}$/.test(normalized)) {
    return null;
  }

  return `tel:${normalized}`;
}

import "server-only";

const BLOCKED_PROTOCOLS = /^(javascript|data|file|vbscript|blob):/i;

export type ExternalLinkValidationResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Validates external URLs for governed content.
 * Only https is permitted. Rejects javascript:, data:, local and malformed URLs.
 */
export function validateExternalUrl(raw: string | null | undefined): ExternalLinkValidationResult {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { ok: true, url: "" };
  }

  const trimmed = raw.trim();

  if (BLOCKED_PROTOCOLS.test(trimmed)) {
    return { ok: false, error: "Blocked URL protocol" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Malformed URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only https external links are permitted" };
  }

  if (!parsed.hostname || parsed.hostname === "localhost") {
    return { ok: false, error: "Local URLs are not permitted" };
  }

  return { ok: true, url: parsed.toString() };
}

/** Optional domain allowlist check — supplementary control only. */
export function isDomainAllowlisted(
  url: string,
  allowlist: readonly string[] | null,
): boolean {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowlist.some(
      (domain) => hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`),
    );
  } catch {
    return false;
  }
}

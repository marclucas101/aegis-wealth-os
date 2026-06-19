import "server-only";

const BLOCKED_PROTOCOLS = /^(javascript|data|file|vbscript|blob):/i;
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
];

export type ExternalLinkValidationResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function decodeUrlForInspection(raw: string): string {
  let current = raw.trim();
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) {
        break;
      }
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

function hasEmbeddedCredentials(parsed: URL): boolean {
  return Boolean(parsed.username || parsed.password);
}

function isPrivateOrLocalHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Validates external URLs for governed content.
 * Only https is permitted. Rejects javascript:, data:, local and malformed URLs.
 */
export function validateExternalUrl(raw: string | null | undefined): ExternalLinkValidationResult {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { ok: true, url: "" };
  }

  const decoded = decodeUrlForInspection(raw);

  if (BLOCKED_PROTOCOLS.test(decoded)) {
    return { ok: false, error: "Blocked URL protocol" };
  }

  if (/javascript\s*:/i.test(decoded) || /data\s*:/i.test(decoded)) {
    return { ok: false, error: "Encoded unsafe URL scheme rejected" };
  }

  let parsed: URL;
  try {
    parsed = new URL(decoded);
  } catch {
    return { ok: false, error: "Malformed URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only https external links are permitted" };
  }

  if (!parsed.hostname || isPrivateOrLocalHost(parsed.hostname)) {
    return { ok: false, error: "Local or private-network URLs are not permitted" };
  }

  if (hasEmbeddedCredentials(parsed)) {
    return { ok: false, error: "URLs with embedded credentials are not permitted" };
  }

  return { ok: true, url: parsed.toString() };
}

/** Optional domain allowlist check — supplementary control only. Human admin approval remains primary. */
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

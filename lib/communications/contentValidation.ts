import "server-only";

import { validateExternalUrl } from "./externalLinkValidation";
import type {
  GovernedContentCategory,
  GovernedContentInput,
  GovernedContentType,
} from "./types";

export type ContentValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const PROHIBITED_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /\bguarantee[ds]?\b/i, message: "Guarantee language detected" },
  { pattern: /\bcertain\s+return/i, message: "Certainty-of-return language detected" },
  { pattern: /\bbest\s+product\b/i, message: "'Best product' language detected" },
  { pattern: /\bsuitable\s+for\s+everyone\b/i, message: "'Suitable for everyone' language detected" },
  { pattern: /\bact\s+now\b/i, message: "Urgency pressure language detected" },
  { pattern: /\blimited\s+time\b/i, message: "Urgency pressure language detected" },
  { pattern: /\bdon'?t\s+miss\s+out\b/i, message: "Fear-based pressure language detected" },
  { pattern: /\boutperform(s|ed|ing)?\b/i, message: "Unsubstantiated performance claim detected" },
  { pattern: /\b(buy|sell|switch)\s+(now|immediately|today)\b/i, message: "Direct buy/sell/switch instruction detected" },
  { pattern: /\brecommend(ed|ation)?\s+you\s+(buy|sell|switch)\b/i, message: "Personalised recommendation language detected" },
];

const HTML_TAG_RE = /<[^>]+>/;

const FIELD_LIMITS = {
  title: 120,
  summary: 400,
  body: 8000,
  externalSourceName: 120,
} as const;

export function stripHtmlTags(text: string): string {
  return text.replace(HTML_TAG_RE, "").trim();
}

export function scanProhibitedLanguage(text: string): string[] {
  const combined = text.toLowerCase();
  const flags: string[] = [];

  for (const { pattern, message } of PROHIBITED_PATTERNS) {
    if (pattern.test(combined)) {
      flags.push(message);
    }
  }

  return flags;
}

export function validateContentInput(
  input: GovernedContentInput,
  options?: { requireExternalSource?: boolean; requireExpiry?: boolean },
): ContentValidationResult {
  const errors: string[] = [];

  if (!input.title?.trim()) {
    errors.push("Title is required");
  } else if (input.title.length > FIELD_LIMITS.title) {
    errors.push(`Title exceeds ${FIELD_LIMITS.title} characters`);
  }

  if (!input.summary?.trim()) {
    errors.push("Summary is required");
  } else if (input.summary.length > FIELD_LIMITS.summary) {
    errors.push(`Summary exceeds ${FIELD_LIMITS.summary} characters`);
  }

  if (input.body && input.body.length > FIELD_LIMITS.body) {
    errors.push(`Body exceeds ${FIELD_LIMITS.body} characters`);
  }

  if (HTML_TAG_RE.test(input.title) || HTML_TAG_RE.test(input.summary) || HTML_TAG_RE.test(input.body)) {
    errors.push("HTML tags are not permitted in content");
  }

  if (!input.category) {
    errors.push("Category is required");
  }

  if (!input.contentType) {
    errors.push("Content type is required");
  }

  if (!input.audienceScope) {
    errors.push("Audience scope is required");
  }

  const textToScan = `${input.title} ${input.summary} ${input.body}`;
  const languageFlags = scanProhibitedLanguage(textToScan);
  errors.push(...languageFlags);

  if (input.contentType === "general_market_update" || input.category === "market_update") {
    if (!input.externalSourceName?.trim()) {
      errors.push("Source name is required for market updates");
    }
    if (!input.expiresAt) {
      errors.push("Expiry or review date is required for market updates");
    }
  }

  if (options?.requireExternalSource && !input.externalSourceName?.trim()) {
    errors.push("External source name is required");
  }

  if (options?.requireExpiry && !input.expiresAt) {
    errors.push("Expiry or review date is required");
  }

  if (input.externalUrl) {
    const urlResult = validateExternalUrl(input.externalUrl);
    if (!urlResult.ok) {
      errors.push(urlResult.error);
    }
  }

  if (input.externalSourceName && input.externalSourceName.length > FIELD_LIMITS.externalSourceName) {
    errors.push(`Source name exceeds ${FIELD_LIMITS.externalSourceName} characters`);
  }

  if (input.contentType === "promotional_product") {
    errors.push("Product-related content requires explicit firm compliance policy approval");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export function categoryToContentType(category: GovernedContentCategory): GovernedContentType {
  switch (category) {
    case "financial_education":
    case "company_update":
    case "regulatory_update":
      return "general_education";
    case "market_update":
      return "general_market_update";
    case "adviser_message":
    case "planning_reminder":
    case "review_reminder":
      return "adviser_message";
    case "document_notification":
    case "appointment_update":
      return "operational_notification";
    case "event":
      return "general_education";
    default:
      return "general_education";
  }
}

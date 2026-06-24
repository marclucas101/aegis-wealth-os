export const LEGACY_PROMOTIONS_RETIRED_CODE = "LEGACY_PROMOTIONS_RETIRED" as const;

export const LEGACY_PROMOTIONS_RETIRED_API_MESSAGE =
  "Legacy Promotions has been retired. Use Governed Communications.";

export const LEGACY_PROMOTIONS_RETIRED_USER_MESSAGE =
  "Legacy Promotions has been retired. Create and manage client communications through Governed Communications.";

export const LEGACY_PROMOTIONS_REPLACEMENT_ADVISER_HREF = "/advisor/insights";
export const LEGACY_PROMOTIONS_REPLACEMENT_CLIENT_HREF = "/insights";

export const LEGACY_PROMOTIONS_RETIRED_QUERY_PARAM = "legacy_promotions_retired";

export const LEGACY_PROMOTIONS_RETIRED_BODY = {
  error: {
    code: LEGACY_PROMOTIONS_RETIRED_CODE,
    message: LEGACY_PROMOTIONS_RETIRED_API_MESSAGE,
  },
} as const;

export function adviserPromotionsRetiredRedirectTarget(): string {
  return `${LEGACY_PROMOTIONS_REPLACEMENT_ADVISER_HREF}?${LEGACY_PROMOTIONS_RETIRED_QUERY_PARAM}=1`;
}

export function clientPromotionsRetiredRedirectTarget(): string {
  return `${LEGACY_PROMOTIONS_REPLACEMENT_CLIENT_HREF}?${LEGACY_PROMOTIONS_RETIRED_QUERY_PARAM}=1`;
}

export function isLegacyPromotionsRetiredNoticeRequested(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): boolean {
  const value = searchParams?.[LEGACY_PROMOTIONS_RETIRED_QUERY_PARAM];
  return value === "1" || value === "true";
}

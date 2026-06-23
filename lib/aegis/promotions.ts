export const PROMOTION_CATEGORIES = [
  "Protection",
  "Investment",
  "Retirement",
  "Education",
  "Estate Planning",
  "Limited Campaign",
  "Client Event",
  "Market Update",
  "General",
] as const;

export const PROMOTION_STATUSES = ["draft", "published", "archived"] as const;

export const PROMOTION_AUDIENCES = ["all_users"] as const;

export type PromotionCategory = (typeof PROMOTION_CATEGORIES)[number];
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];
export type PromotionAudience = (typeof PROMOTION_AUDIENCES)[number];

export type PromotionDetails = {
  highlights?: string[];
  eligibility?: string;
};

export type PromotionRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string;
  details: PromotionDetails | null;
  category: PromotionCategory;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imagePath: string | null;
  attachmentPath: string | null;
  imageSignedUrl: string | null;
  attachmentSignedUrl: string | null;
  audience: PromotionAudience;
  status: PromotionStatus;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Client API shape — excludes adviser/internal and storage path fields. */
export type ClientSafePromotionRecord = Pick<
  PromotionRecord,
  | "id"
  | "title"
  | "subtitle"
  | "summary"
  | "details"
  | "category"
  | "ctaLabel"
  | "ctaUrl"
  | "imageSignedUrl"
  | "attachmentSignedUrl"
  | "status"
  | "priority"
  | "startsAt"
  | "endsAt"
>;

export function isPromotionCurrentlyActive(promotion: PromotionRecord): boolean {
  if (promotion.status !== "published") {
    return false;
  }

  const now = new Date();
  const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
  const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

import "server-only";

import {
  PROMOTION_AUDIENCES,
  PROMOTION_CATEGORIES,
  PROMOTION_STATUSES,
  type PromotionAudience,
  type PromotionCategory,
  type PromotionDetails,
  type PromotionRecord,
  type PromotionStatus,
} from "@/lib/aegis/promotions";

import { createAdminSupabaseClient } from "./admin";
import { createServerSupabaseClient } from "./server";

export {
  PROMOTION_AUDIENCES,
  PROMOTION_CATEGORIES,
  PROMOTION_STATUSES,
  type PromotionAudience,
  type PromotionCategory,
  type PromotionDetails,
  type PromotionRecord,
  type PromotionStatus,
};

export const PROMOTION_BUCKET = "promotion-assets";
export const MAX_PROMOTION_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROMOTION_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const PROMOTION_SIGNED_URL_EXPIRY_SECONDS = 300;

type PromotionRow = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string;
  details: string | null;
  category: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  attachment_url: string | null;
  audience: string;
  status: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PromotionInput = {
  title: string;
  subtitle?: string | null;
  summary: string;
  details?: PromotionDetails | null;
  category: PromotionCategory;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  audience?: PromotionAudience;
  status?: PromotionStatus;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const ATTACHMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg"]);

const FIELD_LIMITS = {
  title: 80,
  subtitle: 140,
  summary: 300,
  highlight: 120,
  eligibility: 180,
  ctaLabel: 60,
} as const;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function mapCategory(value: string): PromotionCategory {
  if ((PROMOTION_CATEGORIES as readonly string[]).includes(value)) {
    return value as PromotionCategory;
  }

  return "General";
}

function mapStatus(value: string): PromotionStatus {
  if ((PROMOTION_STATUSES as readonly string[]).includes(value)) {
    return value as PromotionStatus;
  }

  return "draft";
}

function parseDetails(raw: string | null): PromotionDetails | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const highlights = Array.isArray(record.highlights)
      ? record.highlights
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3)
      : undefined;

    const eligibility =
      typeof record.eligibility === "string"
        ? record.eligibility.trim() || undefined
        : undefined;

    if (!highlights?.length && !eligibility) {
      return null;
    }

    return { highlights, eligibility };
  } catch {
    return null;
  }
}

function serializeDetails(details: PromotionDetails | null | undefined): string | null {
  if (!details) {
    return null;
  }

  const payload: PromotionDetails = {};

  if (details.highlights?.length) {
    payload.highlights = details.highlights
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  if (details.eligibility?.trim()) {
    payload.eligibility = details.eligibility.trim();
  }

  if (!payload.highlights?.length && !payload.eligibility) {
    return null;
  }

  return JSON.stringify(payload);
}

function isPromotionActive(row: PromotionRow, now = new Date()): boolean {
  if (row.status !== "published") {
    return false;
  }

  const startsAt = row.starts_at ? new Date(row.starts_at) : null;
  const endsAt = row.ends_at ? new Date(row.ends_at) : null;

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

async function createSignedUrl(path: string | null): Promise<string | null> {
  if (!path?.trim()) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(PROMOTION_BUCKET)
    .createSignedUrl(path, PROMOTION_SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function mapPromotionRow(
  row: PromotionRow,
  options?: { includeSignedUrls?: boolean },
): Promise<PromotionRecord> {
  const imagePath = row.image_url;
  const attachmentPath = row.attachment_url;

  let imageSignedUrl: string | null = null;
  let attachmentSignedUrl: string | null = null;

  if (options?.includeSignedUrls) {
    imageSignedUrl = await createSignedUrl(imagePath);
    attachmentSignedUrl = await createSignedUrl(attachmentPath);
  }

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    details: parseDetails(row.details),
    category: mapCategory(row.category),
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    imagePath,
    attachmentPath,
    imageSignedUrl,
    attachmentSignedUrl,
    audience: (row.audience as PromotionAudience) ?? "all_users",
    status: mapStatus(row.status),
    priority: row.priority,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rejectForbiddenPromotionFields(body: unknown): {
  rejected: boolean;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { rejected: false };
  }

  const forbidden = [
    "id",
    "created_by",
    "createdBy",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
    "image_url",
    "imageUrl",
    "attachment_url",
    "attachmentUrl",
    "audience",
  ] as const;

  for (const key of forbidden) {
    if (key in body) {
      return {
        rejected: true,
        error: `${key} must not be supplied by the client`,
      };
    }
  }

  return { rejected: false };
}

export function validatePromotionInput(
  input: PromotionInput,
): { ok: true } | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Title is required" };
  }
  if (title.length > FIELD_LIMITS.title) {
    return { ok: false, error: `Title must be at most ${FIELD_LIMITS.title} characters` };
  }

  if (input.subtitle && input.subtitle.trim().length > FIELD_LIMITS.subtitle) {
    return {
      ok: false,
      error: `Subtitle must be at most ${FIELD_LIMITS.subtitle} characters`,
    };
  }

  const summary = input.summary.trim();
  if (!summary) {
    return { ok: false, error: "Summary is required" };
  }
  if (summary.length > FIELD_LIMITS.summary) {
    return {
      ok: false,
      error: `Summary must be at most ${FIELD_LIMITS.summary} characters`,
    };
  }

  if (!(PROMOTION_CATEGORIES as readonly string[]).includes(input.category)) {
    return { ok: false, error: "Invalid category" };
  }

  if (
    input.status &&
    !(PROMOTION_STATUSES as readonly string[]).includes(input.status)
  ) {
    return { ok: false, error: "Invalid status" };
  }

  if (input.details?.highlights) {
    if (input.details.highlights.length > 3) {
      return { ok: false, error: "At most three highlights are allowed" };
    }

    for (const highlight of input.details.highlights) {
      if (highlight.trim().length > FIELD_LIMITS.highlight) {
        return {
          ok: false,
          error: `Each highlight must be at most ${FIELD_LIMITS.highlight} characters`,
        };
      }
    }
  }

  if (
    input.details?.eligibility &&
    input.details.eligibility.trim().length > FIELD_LIMITS.eligibility
  ) {
    return {
      ok: false,
      error: `Eligibility note must be at most ${FIELD_LIMITS.eligibility} characters`,
    };
  }

  if (input.ctaLabel && input.ctaLabel.trim().length > FIELD_LIMITS.ctaLabel) {
    return {
      ok: false,
      error: `CTA label must be at most ${FIELD_LIMITS.ctaLabel} characters`,
    };
  }

  if (input.ctaUrl?.trim()) {
    const url = input.ctaUrl.trim();
    if (
      !url.startsWith("/") &&
      !url.startsWith("https://") &&
      !url.startsWith("http://")
    ) {
      return { ok: false, error: "CTA URL must be an internal path or https URL" };
    }
  }

  if (input.startsAt && input.endsAt) {
    const starts = new Date(input.startsAt);
    const ends = new Date(input.endsAt);
    if (!Number.isNaN(starts.getTime()) && !Number.isNaN(ends.getTime()) && ends < starts) {
      return { ok: false, error: "End date must be on or after start date" };
    }
  }

  return { ok: true };
}

function buildInsertPayload(
  input: PromotionInput,
  createdBy: string,
): Record<string, unknown> {
  return {
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    summary: input.summary.trim(),
    details: serializeDetails(input.details),
    category: input.category,
    cta_label: input.ctaLabel?.trim() || null,
    cta_url: input.ctaUrl?.trim() || null,
    audience: input.audience ?? "all_users",
    status: input.status ?? "draft",
    priority: input.priority ?? 0,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    created_by: createdBy,
  };
}

function buildUpdatePayload(input: Partial<PromotionInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.subtitle !== undefined) payload.subtitle = input.subtitle?.trim() || null;
  if (input.summary !== undefined) payload.summary = input.summary.trim();
  if (input.details !== undefined) payload.details = serializeDetails(input.details);
  if (input.category !== undefined) payload.category = input.category;
  if (input.ctaLabel !== undefined) payload.cta_label = input.ctaLabel?.trim() || null;
  if (input.ctaUrl !== undefined) payload.cta_url = input.ctaUrl?.trim() || null;
  if (input.audience !== undefined) payload.audience = input.audience;
  if (input.status !== undefined) payload.status = input.status;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.startsAt !== undefined) payload.starts_at = input.startsAt;
  if (input.endsAt !== undefined) payload.ends_at = input.endsAt;

  return payload;
}

export async function listPublishedPromotions(): Promise<PromotionRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("status", "published")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load promotions: ${error.message}`);
  }

  const rows = (data ?? []) as PromotionRow[];
  const activeRows = rows.filter((row) => isPromotionActive(row));

  return Promise.all(
    activeRows.map((row) => mapPromotionRow(row, { includeSignedUrls: true })),
  );
}

export async function listAdvisorPromotions(
  viewerUserId: string,
  role: "advisor" | "admin",
): Promise<PromotionRecord[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("promotions")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (role === "advisor") {
    query = query.eq("created_by", viewerUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load promotions: ${error.message}`);
  }

  const rows = (data ?? []) as PromotionRow[];
  return Promise.all(
    rows.map((row) => mapPromotionRow(row, { includeSignedUrls: true })),
  );
}

export type PromotionMutationResult =
  | { ok: false; reason: "not_found" }
  | { ok: true; promotion: PromotionRecord };

export async function getAdvisorPromotionById(
  promotionId: string,
): Promise<PromotionMutationResult> {
  if (!isValidUuid(promotionId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("promotions")
    .select("*")
    .eq("id", promotionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load promotion: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    promotion: await mapPromotionRow(data as PromotionRow, {
      includeSignedUrls: true,
    }),
  };
}

export async function createPromotion(
  createdBy: string,
  input: PromotionInput,
): Promise<PromotionRecord> {
  const validation = validatePromotionInput(input);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("promotions")
    .insert(buildInsertPayload(input, createdBy) as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create promotion: ${error?.message ?? "Unknown error"}`);
  }

  return mapPromotionRow(data as PromotionRow, { includeSignedUrls: true });
}

export async function updatePromotion(
  promotionId: string,
  input: Partial<PromotionInput>,
): Promise<PromotionMutationResult> {
  if (!isValidUuid(promotionId)) {
    return { ok: false, reason: "not_found" };
  }

  const existing = await getAdvisorPromotionById(promotionId);
  if (!existing.ok) {
    return existing;
  }

  const merged: PromotionInput = {
    title: input.title ?? existing.promotion.title,
    subtitle: input.subtitle !== undefined ? input.subtitle : existing.promotion.subtitle,
    summary: input.summary ?? existing.promotion.summary,
    details: input.details !== undefined ? input.details : existing.promotion.details,
    category: input.category ?? existing.promotion.category,
    ctaLabel: input.ctaLabel !== undefined ? input.ctaLabel : existing.promotion.ctaLabel,
    ctaUrl: input.ctaUrl !== undefined ? input.ctaUrl : existing.promotion.ctaUrl,
    audience: input.audience ?? existing.promotion.audience,
    status: input.status ?? existing.promotion.status,
    priority: input.priority ?? existing.promotion.priority,
    startsAt: input.startsAt !== undefined ? input.startsAt : existing.promotion.startsAt,
    endsAt: input.endsAt !== undefined ? input.endsAt : existing.promotion.endsAt,
  };

  const validation = validatePromotionInput(merged);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("promotions")
    .update(buildUpdatePayload(input) as never)
    .eq("id", promotionId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update promotion: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    promotion: await mapPromotionRow(data as PromotionRow, {
      includeSignedUrls: true,
    }),
  };
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts.at(-1)?.toLowerCase() ?? "") : "";
}

export type PromotionAssetKind = "image" | "attachment";

export async function uploadPromotionAsset(
  createdBy: string,
  promotionId: string,
  kind: PromotionAssetKind,
  file: File,
): Promise<PromotionRecord> {
  if (!isValidUuid(promotionId)) {
    throw new Error("Promotion not found");
  }

  const existing = await getAdvisorPromotionById(promotionId);
  if (!existing.ok) {
    throw new Error("Promotion not found");
  }

  const extension = getExtension(file.name);
  const maxBytes =
    kind === "image" ? MAX_PROMOTION_IMAGE_BYTES : MAX_PROMOTION_ATTACHMENT_BYTES;
  const allowedExtensions = kind === "image" ? IMAGE_EXTENSIONS : ATTACHMENT_EXTENSIONS;

  if (!extension || !allowedExtensions.has(extension)) {
    throw new Error(`Unsupported file type for ${kind}`);
  }

  if (file.size > maxBytes) {
    throw new Error(`File exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))}MB`);
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${createdBy}/promotions/${promotionId}/${Date.now()}-${safeName}`;
  const admin = createAdminSupabaseClient();

  const { error: uploadError } = await admin.storage
    .from(PROMOTION_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  const column = kind === "image" ? "image_url" : "attachment_url";
  const { data, error } = await admin
    .from("promotions")
    .update({ [column]: storagePath } as never)
    .eq("id", promotionId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    await admin.storage.from(PROMOTION_BUCKET).remove([storagePath]);
    throw new Error(`Failed to save promotion asset: ${error?.message ?? "Unknown error"}`);
  }

  return mapPromotionRow(data as PromotionRow, { includeSignedUrls: true });
}


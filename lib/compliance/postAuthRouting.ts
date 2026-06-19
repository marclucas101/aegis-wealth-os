import "server-only";

import type { UserRole } from "@/lib/roles";
import { isAdvisorRole } from "@/lib/roles";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

import { isProspectStage, resolveRelationshipStage } from "./relationshipStage";
import type { RelationshipStage } from "./types";

/** Allowlisted post-auth destinations for prospect invitation and return URLs. */
export const PROSPECT_ENTITLED_PATHS = [
  "/prospect",
  "/discover",
  "/discover/submitted",
  "/meeting-preparation",
  "/my-adviser",
  "/dashboard",
  "/document-vault",
  "/profile",
] as const;

export const INVITE_DESTINATION_PATHS = [
  "/prospect",
  "/discover",
  "/meeting-preparation",
  "/my-adviser",
] as const;

export type ProspectEntitledPath = (typeof PROSPECT_ENTITLED_PATHS)[number];
export type InviteDestinationPath = (typeof INVITE_DESTINATION_PATHS)[number];

const DEFAULT_PROSPECT_HOME = "/prospect";
const DEFAULT_ACTIVE_CLIENT_HOME = "/dashboard";
const DEFAULT_ADVISER_HOME = "/advisor";
const DEFAULT_ADMIN_HOME = "/admin";

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) {
    return "";
  }
  if (trimmed.startsWith("//")) {
    return "";
  }
  if (trimmed.includes("://")) {
    return "";
  }
  if (trimmed.includes("\\")) {
    return "";
  }
  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (withoutQuery.includes("..")) {
    return "";
  }
  return withoutQuery || "/";
}

function matchesEntitledPath(path: string, allowed: readonly string[]): boolean {
  const normalized = normalizePath(path);
  if (!normalized) {
    return false;
  }
  return allowed.some(
    (allowedPath) =>
      normalized === allowedPath || normalized.startsWith(`${allowedPath}/`),
  );
}

export function validateInviteDestination(
  destination: string | null | undefined,
): InviteDestinationPath {
  const normalized = normalizePath(destination ?? "");
  if (matchesEntitledPath(normalized, INVITE_DESTINATION_PATHS)) {
    return normalized as InviteDestinationPath;
  }
  return "/prospect";
}

export function validateSafeReturnUrl(input: {
  next: string | null | undefined;
  role: UserRole;
  relationshipStage: RelationshipStage | null;
}): string | null {
  const normalized = normalizePath(input.next ?? "");
  if (!normalized) {
    return null;
  }

  if (isAdvisorRole(input.role)) {
    if (
      normalized === DEFAULT_ADVISER_HOME ||
      normalized.startsWith("/advisor/") ||
      normalized === DEFAULT_ADMIN_HOME ||
      normalized.startsWith("/admin/")
    ) {
      return normalized;
    }
    return null;
  }

  if (input.role === "admin") {
    if (
      normalized === DEFAULT_ADMIN_HOME ||
      normalized.startsWith("/admin/") ||
      normalized === DEFAULT_ADVISER_HOME ||
      normalized.startsWith("/advisor/")
    ) {
      return normalized;
    }
    return null;
  }

  if (input.role === "client") {
    if (!input.relationshipStage) {
      return null;
    }

    if (isProspectStage(input.relationshipStage)) {
      return matchesEntitledPath(normalized, PROSPECT_ENTITLED_PATHS)
        ? normalized
        : null;
    }

    return matchesEntitledPath(normalized, [
      ...PROSPECT_ENTITLED_PATHS,
      "/roadmap",
      "/shield-diagnostic",
      "/stress-testing",
      "/wealth-blueprint",
      "/annual-review",
      "/budget-optimiser",
      "/promotions",
    ])
      ? normalized
      : null;
  }

  return null;
}

export function resolveDefaultHomeForRole(input: {
  role: UserRole;
  relationshipStage: RelationshipStage | null;
}): string {
  if (input.role === "admin") {
    return DEFAULT_ADMIN_HOME;
  }

  if (isAdvisorRole(input.role)) {
    return DEFAULT_ADVISER_HOME;
  }

  if (input.relationshipStage && isProspectStage(input.relationshipStage)) {
    return DEFAULT_PROSPECT_HOME;
  }

  return DEFAULT_ACTIVE_CLIENT_HOME;
}

export function resolvePostAuthDestination(input: {
  user: AppUserRow;
  client: AppClientRow | null;
  requestedNext?: string | null;
}): string {
  const relationshipStage = input.client
    ? resolveRelationshipStage(input.client)
    : null;

  const safeReturn = validateSafeReturnUrl({
    next: input.requestedNext,
    role: input.user.role,
    relationshipStage,
  });

  if (safeReturn) {
    return safeReturn;
  }

  return resolveDefaultHomeForRole({
    role: input.user.role,
    relationshipStage,
  });
}

export function buildInviteSignupUrl(
  origin: string,
  destination: string | null | undefined = "/prospect",
): string {
  const base = origin.replace(/\/$/, "");
  const safeDestination = validateInviteDestination(destination);
  const params = new URLSearchParams({
    invite: "1",
    next: safeDestination,
  });
  return `${base}/signup?${params.toString()}`;
}

export function buildInviteAuthRedirectUrl(
  origin: string,
  destination: string | null | undefined = "/prospect",
): string {
  const base = origin.replace(/\/$/, "");
  const safeDestination = validateInviteDestination(destination);
  const params = new URLSearchParams({
    next: `/auth/continue?next=${encodeURIComponent(safeDestination)}`,
  });
  return `${base}/auth/callback?${params.toString()}`;
}

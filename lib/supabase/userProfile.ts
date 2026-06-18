import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "./auditLog";
import {
  findLinkablePlaceholderClient,
  linkPlaceholderClientToUser,
  normalizeEmail,
} from "./clientOnboarding";
import { createAdminSupabaseClient } from "./admin";
import { createServerSupabaseClient } from "./server";
import type { Database } from "./types";

export type UserRole = "client" | "advisor" | "admin";

export type ClientStatus =
  | "prospect"
  | "onboarding"
  | "active"
  | "review_due"
  | "archived";

export type AppUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  organisation: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type AppClientRow = {
  id: string;
  user_id: string | null;
  advisor_user_id: string | null;
  status: ClientStatus;
  display_name: string;
  email: string | null;
  phone: string | null;
  currency_code: string;
  onboarding_step: string | null;
  last_review_at: string | null;
  next_review_due: string | null;
  feedback_prompted_at: string | null;
  feedback_submitted_at: string | null;
  feedback_prompt_dismissed_at: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
};

export type EnsureUserClientProfileResult =
  | { authenticated: false }
  | {
      authenticated: true;
      authUser: User;
      user: AppUserRow;
      client: AppClientRow;
    };

function readFullName(authUser: User): string | null {
  const metadata = authUser.user_metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const candidate = metadata.full_name ?? metadata.name;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

export function displayNameFromAuthUser(authUser: User): string {
  const fullName = readFullName(authUser);
  if (fullName) {
    return fullName;
  }

  const email = authUser.email ?? "";
  const prefix = email.split("@")[0]?.trim();
  return prefix || "Client";
}

/** Explicit column lists for `users` and `clients` (avoids `select *` payloads). */
export const USER_COLUMNS =
  "id, email, full_name, role, avatar_url, organisation, phone, created_at, updated_at";
export const CLIENT_COLUMNS =
  "id, user_id, advisor_user_id, status, display_name, email, phone, currency_code, onboarding_step, last_review_at, next_review_due, feedback_prompted_at, feedback_submitted_at, feedback_prompt_dismissed_at, date_of_birth, created_at, updated_at";

async function fetchUserRow(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<AppUserRow | null> {
  const { data, error } = await admin
    .from("users")
    .select(USER_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user profile: ${error.message}`);
  }

  return data as AppUserRow | null;
}

async function fetchClientByUserId(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<AppClientRow | null> {
  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client profile: ${error.message}`);
  }

  return data as AppClientRow | null;
}

/**
 * Authoritative, idempotent, concurrency-safe provisioning of the signed-in
 * user's own `public.clients` row. This is the single user-linked client
 * creation path in the application.
 *
 * Concurrency model: the `clients_user_id_unique` index (one row per non-NULL
 * `user_id`) is the source of truth. We issue `INSERT ... ON CONFLICT (user_id)
 * DO NOTHING` via Supabase `upsert(..., { ignoreDuplicates: true })`, then
 * re-read the canonical row by `user_id`.
 *
 * Guarantees:
 * - Never creates a second row for the same user, even when two browser tabs or
 *   two Vercel functions provision concurrently — the loser of the race is a
 *   no-op `DO NOTHING`, not a duplicate insert.
 * - Never overwrites an existing row's data (notably a non-NULL
 *   `advisor_user_id`) because `ignoreDuplicates` skips the conflicting row
 *   entirely rather than updating it.
 * - A unique-violation (`23505`) from a row created between our lookup and our
 *   upsert is treated as success: we fall through to the refetch instead of
 *   failing the request.
 * - Always returns the canonical row resolved by `user_id`, never an arbitrary
 *   row.
 */
async function provisionClientRow(
  admin: SupabaseClient<Database>,
  authUser: User,
  email: string,
): Promise<AppClientRow> {
  const { error: upsertError } = await admin
    .from("clients")
    .upsert(
      {
        user_id: authUser.id,
        advisor_user_id: null,
        display_name: displayNameFromAuthUser(authUser),
        email,
        status: "onboarding",
        currency_code: "SGD",
      } as never,
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  // A concurrent insert can still surface a unique violation; that means the
  // row now exists, so it is not an error for us — fall through to the refetch.
  if (upsertError && upsertError.code !== "23505") {
    throw new Error(`Failed to provision client profile: ${upsertError.message}`);
  }

  const clientRow = await fetchClientByUserId(admin, authUser.id);
  if (!clientRow) {
    throw new Error(
      "Failed to provision client profile: client row missing after upsert.",
    );
  }

  return clientRow;
}

/**
 * Resolves the current session user and ensures matching public.users and
 * public.clients rows exist (MVP: one auth user → one client row).
 *
 * Wrapped in {@link cache} so that, within a single server request, the session
 * resolution and idempotent provisioning run at most once even when multiple
 * loaders/components depend on the client profile. This prevents duplicate
 * `auth.getUser()` calls and duplicate provisioning insert attempts per request.
 */
export const ensureUserClientProfile = cache(
  _ensureUserClientProfile,
);

async function _ensureUserClientProfile(): Promise<EnsureUserClientProfileResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { authenticated: false };
  }

  const email = authUser.email?.trim();
  if (!email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  const admin = createAdminSupabaseClient();
  const fullName = readFullName(authUser);

  let userRow = await fetchUserRow(admin, authUser.id);
  if (!userRow) {
    const { data, error } = await admin
      .from("users")
      .insert({
        id: authUser.id,
        email,
        full_name: fullName,
        role: "client",
      } as never)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        userRow = await fetchUserRow(admin, authUser.id);
      }
      if (!userRow) {
        throw new Error(`Failed to provision user profile: ${error.message}`);
      }
    } else {
      userRow = data as AppUserRow;
    }
  }

  let clientRow = await fetchClientByUserId(admin, authUser.id);
  let linkedPlaceholder = false;

  if (!clientRow && userRow.role === "client") {
    const placeholder = await findLinkablePlaceholderClient(email);

    if (placeholder) {
      const linked = await linkPlaceholderClientToUser({
        placeholder,
        userId: authUser.id,
        fallbackDisplayName: displayNameFromAuthUser(authUser),
      });

      if (linked) {
        clientRow = linked;
        linkedPlaceholder = true;
      }
    }
  }

  if (!clientRow) {
    clientRow = await provisionClientRow(admin, authUser, email);
  }

  if (linkedPlaceholder && clientRow) {
    await writeAuditLog({
      clientId: clientRow.id,
      userId: authUser.id,
      action: "client_placeholder_linked_to_user",
      entityType: "clients",
      entityId: clientRow.id,
      metadata: {
        client_id: clientRow.id,
        user_id: authUser.id,
        email: normalizeEmail(email),
        advisor_user_id: clientRow.advisor_user_id,
      },
    });
  }

  return {
    authenticated: true,
    authUser,
    user: userRow,
    client: clientRow,
  };
}

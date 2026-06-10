import "server-only";

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

async function fetchUserRow(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<AppUserRow | null> {
  const { data, error } = await admin
    .from("users")
    .select("*")
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
    .select("*")
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
 * Resolves the current session user and ensures matching public.users and
 * public.clients rows exist (MVP: one auth user → one client row).
 */
export async function ensureUserClientProfile(): Promise<EnsureUserClientProfileResult> {
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
    const { data, error } = await admin
      .from("clients")
      .insert({
        user_id: authUser.id,
        advisor_user_id: null,
        display_name: displayNameFromAuthUser(authUser),
        email,
        status: "onboarding",
        currency_code: "SGD",
      } as never)
      .select("*")
      .single();

    if (error) {
      clientRow = await fetchClientByUserId(admin, authUser.id);
      if (!clientRow) {
        throw new Error(`Failed to provision client profile: ${error.message}`);
      }
    } else {
      clientRow = data as AppClientRow;
    }
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

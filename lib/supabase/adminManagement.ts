import "server-only";

import type { User } from "@supabase/supabase-js";

import type { ShieldRating } from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import { createServerSupabaseClient } from "./server";
import type { AppClientRow, AppUserRow, ClientStatus, UserRole } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USER_ROLES: UserRole[] = ["client", "advisor", "admin"];
const ADVISOR_ASSIGNABLE_ROLES: UserRole[] = ["advisor", "admin"];

export type AdminAccessDeniedReason = "unauthenticated" | "forbidden";

export type RequireAdminAccessResult =
  | { allowed: false; reason: AdminAccessDeniedReason }
  | { allowed: true; authUser: User; user: AppUserRow };

export type AdminUserRecord = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  createdAt: string;
  linkedClientCount: number;
};

export type AdminClientRecord = {
  id: string;
  displayName: string;
  email: string | null;
  status: ClientStatus;
  advisorUserId: string | null;
  advisorEmail: string | null;
  advisorFullName: string | null;
  shieldScore: number | null;
  rating: ShieldRating | null;
};

export type UpdateUserRoleResult =
  | { ok: true; user: AdminUserRecord; oldRole: UserRole; newRole: UserRole }
  | {
      ok: false;
      reason:
        | "not_found"
        | "invalid_role"
        | "forbidden_self_demote"
        | "unchanged";
    };

export type AssignClientAdvisorResult =
  | {
      ok: true;
      clientId: string;
      oldAdvisorUserId: string | null;
      newAdvisorUserId: string | null;
    }
  | {
      ok: false;
      reason: "not_found" | "invalid_advisor" | "unchanged";
    };

type ShieldScoreSummary = {
  client_id: string;
  adjusted_shield_score: number | string;
  rating: ShieldRating;
};

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Server-side gate for Admin Console routes.
 * Identity is derived from supabase.auth.getUser() — never from browser input.
 */
export async function requireAdminAccess(): Promise<RequireAdminAccessResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { allowed: false, reason: "unauthenticated" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user profile: ${error.message}`);
  }

  const userRow = data as AppUserRow | null;

  if (!userRow || userRow.role !== "admin") {
    return { allowed: false, reason: "forbidden" };
  }

  return { allowed: true, authUser, user: userRow };
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapUserRow(
  row: AppUserRow,
  linkedClientCount: number,
): AdminUserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at,
    linkedClientCount,
  };
}

function buildLinkedClientCounts(
  clients: Pick<AppClientRow, "user_id" | "advisor_user_id">[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const client of clients) {
    if (client.user_id) {
      counts.set(client.user_id, (counts.get(client.user_id) ?? 0) + 1);
    }
    if (client.advisor_user_id) {
      counts.set(
        client.advisor_user_id,
        (counts.get(client.advisor_user_id) ?? 0) + 1,
      );
    }
  }

  return counts;
}

export async function loadAdminUsers(): Promise<AdminUserRecord[]> {
  const admin = createAdminSupabaseClient();

  const [usersResult, clientsResult] = await Promise.all([
    admin.from("users").select("*").order("email", { ascending: true }),
    admin.from("clients").select("user_id, advisor_user_id"),
  ]);

  if (usersResult.error) {
    throw new Error(`Failed to load users: ${usersResult.error.message}`);
  }

  if (clientsResult.error) {
    throw new Error(`Failed to load clients: ${clientsResult.error.message}`);
  }

  const linkedCounts = buildLinkedClientCounts(
    (clientsResult.data ?? []) as Pick<AppClientRow, "user_id" | "advisor_user_id">[],
  );

  return ((usersResult.data ?? []) as AppUserRow[]).map((row) =>
    mapUserRow(row, linkedCounts.get(row.id) ?? 0),
  );
}

export async function updateUserRole(
  actorUserId: string,
  targetUserId: string,
  newRole: UserRole,
): Promise<UpdateUserRoleResult> {
  if (!isUserRole(newRole)) {
    return { ok: false, reason: "invalid_role" };
  }

  const admin = createAdminSupabaseClient();

  const { data: targetRow, error: fetchError } = await admin
    .from("users")
    .select("*")
    .eq("id", targetUserId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load target user: ${fetchError.message}`);
  }

  const existing = targetRow as AppUserRow | null;
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  if (existing.role === newRole) {
    return { ok: false, reason: "unchanged" };
  }

  if (
    actorUserId === targetUserId &&
    existing.role === "admin" &&
    newRole !== "admin"
  ) {
    const { count, error: countError } = await admin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) {
      throw new Error(`Failed to count admins: ${countError.message}`);
    }

    if ((count ?? 0) <= 1) {
      return { ok: false, reason: "forbidden_self_demote" };
    }
  }

  const { data: updatedRow, error: updateError } = await admin
    .from("users")
    .update({ role: newRole } as never)
    .eq("id", targetUserId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Failed to update user role: ${updateError.message}`);
  }

  const { data: clientsData, error: clientsError } = await admin
    .from("clients")
    .select("user_id, advisor_user_id");

  if (clientsError) {
    throw new Error(`Failed to load clients: ${clientsError.message}`);
  }

  const linkedCounts = buildLinkedClientCounts(
    (clientsData ?? []) as Pick<AppClientRow, "user_id" | "advisor_user_id">[],
  );

  return {
    ok: true,
    user: mapUserRow(updatedRow as AppUserRow, linkedCounts.get(targetUserId) ?? 0),
    oldRole: existing.role,
    newRole,
  };
}

export async function loadAdminClients(): Promise<AdminClientRecord[]> {
  const admin = createAdminSupabaseClient();

  const { data: clientsData, error: clientsError } = await admin
    .from("clients")
    .select("*")
    .order("display_name", { ascending: true });

  if (clientsError) {
    throw new Error(`Failed to load clients: ${clientsError.message}`);
  }

  const clients = (clientsData ?? []) as AppClientRow[];
  if (clients.length === 0) {
    return [];
  }

  const clientIds = clients.map((client) => client.id);
  const advisorIds = [
    ...new Set(
      clients
        .map((client) => client.advisor_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [shieldResult, advisorsResult] = await Promise.all([
    admin
      .from("shield_scores")
      .select("client_id, adjusted_shield_score, rating")
      .in("client_id", clientIds)
      .eq("is_current", true),
    advisorIds.length > 0
      ? admin
          .from("users")
          .select("id, email, full_name")
          .in("id", advisorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (shieldResult.error) {
    throw new Error(
      `Failed to load shield scores: ${shieldResult.error.message}`,
    );
  }

  if (advisorsResult.error) {
    throw new Error(`Failed to load advisors: ${advisorsResult.error.message}`);
  }

  const shieldByClientId = new Map<string, ShieldScoreSummary>();
  for (const row of (shieldResult.data ?? []) as ShieldScoreSummary[]) {
    shieldByClientId.set(row.client_id, row);
  }

  const advisorById = new Map<
    string,
    { email: string; full_name: string | null }
  >();
  for (const row of (advisorsResult.data ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
  }>) {
    advisorById.set(row.id, { email: row.email, full_name: row.full_name });
  }

  return clients.map((client) => {
    const shield = shieldByClientId.get(client.id);
    const advisor = client.advisor_user_id
      ? advisorById.get(client.advisor_user_id)
      : undefined;

    return {
      id: client.id,
      displayName: client.display_name,
      email: client.email,
      status: client.status,
      advisorUserId: client.advisor_user_id,
      advisorEmail: advisor?.email ?? null,
      advisorFullName: advisor?.full_name ?? null,
      shieldScore: toNumber(shield?.adjusted_shield_score),
      rating: shield?.rating ?? null,
    };
  });
}

export async function assignClientAdvisor(
  clientId: string,
  advisorUserId: string | null,
): Promise<AssignClientAdvisorResult> {
  const admin = createAdminSupabaseClient();

  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    throw new Error(`Failed to load client: ${clientError.message}`);
  }

  const existing = clientRow as AppClientRow | null;
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  if (existing.advisor_user_id === advisorUserId) {
    return { ok: false, reason: "unchanged" };
  }

  if (advisorUserId) {
    const { data: advisorRow, error: advisorError } = await admin
      .from("users")
      .select("id, role")
      .eq("id", advisorUserId)
      .maybeSingle();

    if (advisorError) {
      throw new Error(`Failed to load advisor user: ${advisorError.message}`);
    }

    const advisor = advisorRow as { id: string; role: UserRole } | null;
    if (
      !advisor ||
      !ADVISOR_ASSIGNABLE_ROLES.includes(advisor.role)
    ) {
      return { ok: false, reason: "invalid_advisor" };
    }
  }

  const { error: updateError } = await admin
    .from("clients")
    .update({ advisor_user_id: advisorUserId } as never)
    .eq("id", clientId);

  if (updateError) {
    throw new Error(`Failed to assign advisor: ${updateError.message}`);
  }

  return {
    ok: true,
    clientId,
    oldAdvisorUserId: existing.advisor_user_id,
    newAdvisorUserId: advisorUserId,
  };
}

export function rejectForbiddenIdentityFields(
  body: unknown,
): { rejected: true; error: string } | { rejected: false } {
  if (!body || typeof body !== "object") {
    return { rejected: false };
  }

  const forbiddenKeys = [
    "admin_id",
    "adminId",
    "user_id",
    "userId",
    "advisor_id",
    "advisorId",
    "client_id",
    "clientId",
  ];

  for (const key of forbiddenKeys) {
    if (key in body) {
      return {
        rejected: true,
        error: `${key} must not be supplied by the client`,
      };
    }
  }

  return { rejected: false };
}

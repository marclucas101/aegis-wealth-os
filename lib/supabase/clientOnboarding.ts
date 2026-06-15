import "server-only";

import { createAdminSupabaseClient } from "./admin";
import { isValidUuid } from "./adminManagement";
import {
  CLIENT_COLUMNS,
  USER_COLUMNS,
  type AppClientRow,
  type AppUserRow,
  type ClientStatus,
  type UserRole,
} from "./userProfile";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONBOARDING_STATUSES: ClientStatus[] = ["onboarding", "prospect"];
const ADVISOR_ASSIGNABLE_ROLES: UserRole[] = ["advisor", "admin"];

export type OnboardingClientRecord = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  advisorUserId: string | null;
  advisorEmail: string | null;
  advisorFullName: string | null;
  hasAuthAccount: boolean;
  hasCompletedDiscover: boolean;
  lastActivityAt: string | null;
  createdAt: string;
};

export type CreatePlaceholderClientInput = {
  displayName: string;
  email: string;
  phone?: string | null;
  advisorUserId: string;
};

export type CreatePlaceholderClientResult =
  | {
      ok: true;
      client: OnboardingClientRecord;
      linkedExistingUser: boolean;
    }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "duplicate_email"
        | "invalid_advisor"
        | "unsafe_link";
      message: string;
    };

export type InviteClientInput = {
  email: string;
  actorUserId: string;
  scope: "admin" | "advisor";
  advisorUserId: string;
  redirectOrigin: string;
};

export type InviteClientResult =
  | {
      ok: true;
      method: "email";
      clientId: string;
      email: string;
      advisorUserId: string;
    }
  | {
      ok: true;
      method: "manual";
      clientId: string;
      email: string;
      advisorUserId: string;
      signupUrl: string;
      instructions: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "not_found"
        | "forbidden"
        | "already_registered";
      message: string;
    };

type DiscoverSummary = {
  client_id: string;
  completed_at: string;
};

type AdvisorSummary = {
  id: string;
  email: string;
  full_name: string | null;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function buildSignupUrl(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/signup`;
}

export function buildInviteInstructions(
  email: string,
  origin: string,
): { signupUrl: string; instructions: string } {
  const signupUrl = buildSignupUrl(origin);
  const instructions = [
    `AEGIS Wealth OS — Client signup instructions`,
    ``,
    `1. Open the signup page: ${signupUrl}`,
    `2. Create an account using this email address: ${email}`,
    `3. Complete the Discover onboarding flow after signing in`,
    ``,
    `Your advisor has prepared your client record. Sign up with the exact email above so your account links automatically.`,
  ].join("\n");

  return { signupUrl, instructions };
}

function maxIsoDate(...dates: Array<string | null | undefined>): string | null {
  const valid = dates
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (valid.length === 0) {
    return null;
  }

  return new Date(Math.max(...valid.map((date) => date.getTime()))).toISOString();
}

async function findClientByEmail(
  email: string,
): Promise<AppClientRow | null> {
  const admin = createAdminSupabaseClient();
  const normalized = normalizeEmail(email);

  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_COLUMNS)
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up client by email: ${error.message}`);
  }

  return data as AppClientRow | null;
}

async function findUserByEmail(email: string): Promise<AppUserRow | null> {
  const admin = createAdminSupabaseClient();
  const normalized = normalizeEmail(email);

  const { data, error } = await admin
    .from("users")
    .select(USER_COLUMNS)
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up user by email: ${error.message}`);
  }

  return data as AppUserRow | null;
}

async function findClientByUserId(userId: string): Promise<AppClientRow | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up client by user id: ${error.message}`);
  }

  return data as AppClientRow | null;
}

async function validateAdvisorUserId(
  advisorUserId: string,
): Promise<{ ok: true } | { ok: false; reason: "invalid_advisor" }> {
  if (!isValidUuid(advisorUserId)) {
    return { ok: false, reason: "invalid_advisor" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role")
    .eq("id", advisorUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate advisor: ${error.message}`);
  }

  const advisor = data as { id: string; role: UserRole } | null;
  if (!advisor || !ADVISOR_ASSIGNABLE_ROLES.includes(advisor.role)) {
    return { ok: false, reason: "invalid_advisor" };
  }

  return { ok: true };
}

async function mapOnboardingRows(
  clients: AppClientRow[],
): Promise<OnboardingClientRecord[]> {
  if (clients.length === 0) {
    return [];
  }

  const admin = createAdminSupabaseClient();
  const clientIds = clients.map((client) => client.id);
  const advisorIds = [
    ...new Set(
      clients
        .map((client) => client.advisor_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [discoverResult, advisorsResult] = await Promise.all([
    admin
      .from("discover_profiles")
      .select("client_id, completed_at")
      .in("client_id", clientIds)
      .eq("is_current", true),
    advisorIds.length > 0
      ? admin
          .from("users")
          .select("id, email, full_name")
          .in("id", advisorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (discoverResult.error) {
    throw new Error(
      `Failed to load discover profiles: ${discoverResult.error.message}`,
    );
  }

  if (advisorsResult.error) {
    throw new Error(`Failed to load advisors: ${advisorsResult.error.message}`);
  }

  const discoverByClient = new Map<string, DiscoverSummary>();
  for (const row of (discoverResult.data ?? []) as DiscoverSummary[]) {
    discoverByClient.set(row.client_id, row);
  }

  const advisorById = new Map<string, AdvisorSummary>();
  for (const row of (advisorsResult.data ?? []) as AdvisorSummary[]) {
    advisorById.set(row.id, row);
  }

  return clients.map((client) => {
    const discover = discoverByClient.get(client.id);
    const advisor = client.advisor_user_id
      ? advisorById.get(client.advisor_user_id)
      : undefined;

    return {
      id: client.id,
      displayName: client.display_name,
      email: client.email,
      phone: client.phone,
      status: client.status,
      advisorUserId: client.advisor_user_id,
      advisorEmail: advisor?.email ?? null,
      advisorFullName: advisor?.full_name ?? null,
      hasAuthAccount: client.user_id != null,
      hasCompletedDiscover: Boolean(discover?.completed_at),
      lastActivityAt: maxIsoDate(
        client.updated_at,
        discover?.completed_at,
        client.created_at,
      ),
      createdAt: client.created_at,
    };
  });
}

function mapClientRowToOnboardingRecord(
  client: AppClientRow,
  advisor?: AdvisorSummary | null,
  discover?: DiscoverSummary | null,
): OnboardingClientRecord {
  return {
    id: client.id,
    displayName: client.display_name,
    email: client.email,
    phone: client.phone,
    status: client.status,
    advisorUserId: client.advisor_user_id,
    advisorEmail: advisor?.email ?? null,
    advisorFullName: advisor?.full_name ?? null,
    hasAuthAccount: client.user_id != null,
    hasCompletedDiscover: Boolean(discover?.completed_at),
    lastActivityAt: maxIsoDate(
      client.updated_at,
      discover?.completed_at,
      client.created_at,
    ),
    createdAt: client.created_at,
  };
}

/**
 * Loads onboarding-tracked clients for admin or advisor consoles.
 */
export async function loadOnboardingClients(input: {
  scope: "admin" | "advisor";
  advisorUserId?: string;
}): Promise<OnboardingClientRecord[]> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("clients")
    .select(CLIENT_COLUMNS)
    .in("status", ONBOARDING_STATUSES)
    .order("created_at", { ascending: false });

  if (input.scope === "advisor") {
    if (!input.advisorUserId) {
      throw new Error("advisorUserId is required for advisor scope");
    }

    query = query.eq("advisor_user_id", input.advisorUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load onboarding clients: ${error.message}`);
  }

  return mapOnboardingRows((data ?? []) as AppClientRow[]);
}

/**
 * Creates a placeholder client record for advisor-led onboarding.
 * Deduplicates by email and links an existing auth user when safe.
 */
export async function createPlaceholderClient(
  input: CreatePlaceholderClientInput,
): Promise<CreatePlaceholderClientResult> {
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() ? input.phone.trim() : null;

  if (!displayName || !isValidEmail(email)) {
    return {
      ok: false,
      reason: "invalid_input",
      message: "Valid display name and email are required",
    };
  }

  const advisorCheck = await validateAdvisorUserId(input.advisorUserId);
  if (!advisorCheck.ok) {
    return {
      ok: false,
      reason: "invalid_advisor",
      message: "Advisor must be a user with advisor or admin role",
    };
  }

  const existingClient = await findClientByEmail(email);
  if (existingClient) {
    return {
      ok: false,
      reason: "duplicate_email",
      message: "A client record with this email already exists",
    };
  }

  const existingUser = await findUserByEmail(email);
  let linkedUserId: string | null = null;

  if (existingUser) {
    if (existingUser.role !== "client") {
      return {
        ok: false,
        reason: "unsafe_link",
        message:
          "This email belongs to an advisor or admin account and cannot be used for a client placeholder",
      };
    }

    const linkedClient = await findClientByUserId(existingUser.id);
    if (linkedClient) {
      return {
        ok: false,
        reason: "duplicate_email",
        message: "An account with this email already has a linked client record",
      };
    }

    linkedUserId = existingUser.id;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .insert({
      user_id: linkedUserId,
      advisor_user_id: input.advisorUserId,
      display_name: displayName,
      email,
      phone,
      status: "onboarding",
      currency_code: "SGD",
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create placeholder client: ${error.message}`);
  }

  const clientRow = data as AppClientRow;
  const advisor = await admin
    .from("users")
    .select("id, email, full_name")
    .eq("id", input.advisorUserId)
    .maybeSingle();

  if (advisor.error) {
    throw new Error(`Failed to load advisor profile: ${advisor.error.message}`);
  }

  return {
    ok: true,
    client: mapClientRowToOnboardingRecord(
      clientRow,
      advisor.data as AdvisorSummary | null,
    ),
    linkedExistingUser: linkedUserId != null,
  };
}

async function resolveOnboardingClientForInvite(input: {
  email: string;
  scope: "admin" | "advisor";
  advisorUserId: string;
}): Promise<AppClientRow | null> {
  const client = await findClientByEmail(input.email);
  if (!client) {
    return null;
  }

  if (!ONBOARDING_STATUSES.includes(client.status)) {
    return null;
  }

  if (
    input.scope === "advisor" &&
    client.advisor_user_id !== input.advisorUserId
  ) {
    return null;
  }

  return client;
}

/**
 * Invites a client by email when Supabase Auth invite is available.
 * Falls back to manual signup instructions when email delivery is unavailable.
 */
export async function inviteClientByEmail(
  input: InviteClientInput,
): Promise<InviteClientResult> {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) {
    return {
      ok: false,
      reason: "invalid_input",
      message: "Valid email is required",
    };
  }

  const client = await resolveOnboardingClientForInvite({
    email,
    scope: input.scope,
    advisorUserId: input.advisorUserId,
  });

  if (!client) {
    return {
      ok: false,
      reason: "not_found",
      message: "No onboarding client record found for this email",
    };
  }

  if (!client.advisor_user_id) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Assign an advisor before sending an invitation",
    };
  }

  if (client.user_id) {
    return {
      ok: false,
      reason: "already_registered",
      message: "This client already has an auth account linked",
    };
  }

  const admin = createAdminSupabaseClient();
  const redirectTo = buildSignupUrl(input.redirectOrigin);

  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: client.display_name,
      },
    });

  let linkedUserId: string | null = inviteData?.user?.id ?? null;

  if (inviteError || !linkedUserId) {
    const existingUser = await findUserByEmail(email);

    if (
      existingUser &&
      existingUser.role === "client" &&
      !(await findClientByUserId(existingUser.id))
    ) {
      linkedUserId = existingUser.id;
    } else {
      const { signupUrl, instructions } = buildInviteInstructions(
        email,
        input.redirectOrigin,
      );

      return {
        ok: true,
        method: "manual",
        clientId: client.id,
        email,
        advisorUserId: client.advisor_user_id,
        signupUrl,
        instructions,
      };
    }
  }

  const { error: linkError } = await admin
    .from("clients")
    .update({ user_id: linkedUserId } as never)
    .eq("id", client.id)
    .is("user_id", null);

  if (linkError) {
    throw new Error(`Failed to link invited user to client: ${linkError.message}`);
  }

  return {
    ok: true,
    method: "email",
    clientId: client.id,
    email,
    advisorUserId: client.advisor_user_id,
  };
}

/**
 * Finds an unlinked placeholder client matching the given email.
 * When multiple placeholders share the same email, returns the most recently
 * created row with status onboarding or prospect.
 */
export async function findLinkablePlaceholderClient(
  email: string,
): Promise<AppClientRow | null> {
  const admin = createAdminSupabaseClient();
  const normalized = normalizeEmail(email);

  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_COLUMNS)
    .ilike("email", normalized)
    .is("user_id", null)
    .in("status", ONBOARDING_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to find linkable placeholder client: ${error.message}`,
    );
  }

  return data as AppClientRow | null;
}

/**
 * Links a placeholder client row to an authenticated client user.
 * Preserves advisor_user_id and display_name unless display_name is empty.
 */
export async function linkPlaceholderClientToUser(input: {
  placeholder: AppClientRow;
  userId: string;
  fallbackDisplayName: string;
}): Promise<AppClientRow | null> {
  const admin = createAdminSupabaseClient();

  const updates: { user_id: string; display_name?: string } = {
    user_id: input.userId,
  };

  if (!input.placeholder.display_name.trim()) {
    updates.display_name = input.fallbackDisplayName;
  }

  const { data, error } = await admin
    .from("clients")
    .update(updates as never)
    .eq("id", input.placeholder.id)
    .is("user_id", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to link placeholder client: ${error.message}`);
  }

  if (data) {
    return data as AppClientRow;
  }

  const linkedForUser = await findClientByUserId(input.userId);
  if (linkedForUser) {
    return linkedForUser;
  }

  const { data: refreshed, error: refreshError } = await admin
    .from("clients")
    .select("*")
    .eq("id", input.placeholder.id)
    .maybeSingle();

  if (refreshError) {
    throw new Error(
      `Failed to reload placeholder client: ${refreshError.message}`,
    );
  }

  const refreshedRow = refreshed as AppClientRow | null;
  if (refreshedRow?.user_id === input.userId) {
    return refreshedRow;
  }

  return null;
}

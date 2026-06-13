import "server-only";

import type { MyClientsListItem, MyClientsListPage } from "@/lib/aegis/myClients";
import { DEFAULT_MY_CLIENTS_PAGE_SIZE } from "@/lib/aegis/myClients";
import type { ShieldRating } from "@/src/lib/scoring/types";

import { createAdminSupabaseClient } from "./admin";
import type { ClientStatus } from "./userProfile";

export type AdvisorClientListFilters = {
  q?: string;
  status?: ClientStatus | "all";
  page?: number;
  pageSize?: number;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function isReviewDue(client: {
  status: ClientStatus;
  next_review_due: string | null;
}): boolean {
  if (client.status === "review_due") {
    return true;
  }

  if (!client.next_review_due) {
    return false;
  }

  const due = new Date(client.next_review_due);
  return !Number.isNaN(due.getTime()) && due < new Date();
}

export async function loadAdvisorClientListPage(
  authUserId: string,
  userRole: "advisor" | "admin",
  filters: AdvisorClientListFilters = {},
): Promise<MyClientsListPage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    50,
    Math.max(1, filters.pageSize ?? DEFAULT_MY_CLIENTS_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createAdminSupabaseClient();

  let countQuery = admin
    .from("clients")
    .select("id", { count: "exact", head: true });

  let dataQuery = admin
    .from("clients")
    .select(
      "id, display_name, email, status, onboarding_step, next_review_due, updated_at, advisor_user_id",
    )
    .order("display_name", { ascending: true })
    .range(from, to);

  if (userRole === "advisor") {
    countQuery = countQuery.eq("advisor_user_id", authUserId);
    dataQuery = dataQuery.eq("advisor_user_id", authUserId);
  }

  const search = filters.q?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_]/g, "")}%`;
    const orFilter = `display_name.ilike.${pattern},email.ilike.${pattern}`;
    countQuery = countQuery.or(orFilter);
    dataQuery = dataQuery.or(orFilter);
  }

  if (filters.status && filters.status !== "all") {
    countQuery = countQuery.eq("status", filters.status);
    dataQuery = dataQuery.eq("status", filters.status);
  }

  const [{ count, error: countError }, { data, error: dataError }] =
    await Promise.all([countQuery, dataQuery]);

  if (countError) {
    throw new Error(`Failed to count advisor clients: ${countError.message}`);
  }

  if (dataError) {
    throw new Error(`Failed to load advisor clients: ${dataError.message}`);
  }

  const totalCount = count ?? 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  const clients = (data ?? []) as Array<{
    id: string;
    display_name: string;
    email: string | null;
    status: ClientStatus;
    onboarding_step: string | null;
    next_review_due: string | null;
    updated_at: string;
  }>;

  if (clients.length === 0) {
    return {
      clients: [],
      page,
      pageSize,
      totalCount,
      totalPages,
    };
  }

  const clientIds = clients.map((client) => client.id);
  const now = new Date().toISOString();

  const [
    shieldResult,
    documentsResult,
    budgetResult,
    appointmentsResult,
    feedbackResult,
    discoverResult,
  ] = await Promise.all([
    admin
      .from("shield_scores")
      .select("client_id, adjusted_shield_score, rating, computed_at")
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("documents")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .eq("is_archived", false),
    admin
      .from("client_budgets")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("is_current", true),
    admin
      .from("adviser_appointments")
      .select("client_id, starts_at")
      .in("client_id", clientIds)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", now)
      .order("starts_at", { ascending: true }),
    admin
      .from("adviser_feedback")
      .select("client_id, status, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false }),
    admin
      .from("discover_profiles")
      .select("client_id, completed_at")
      .in("client_id", clientIds)
      .eq("is_current", true),
  ]);

  if (shieldResult.error) {
    throw new Error(`Failed to load shield scores: ${shieldResult.error.message}`);
  }
  if (documentsResult.error) {
    throw new Error(`Failed to load documents: ${documentsResult.error.message}`);
  }
  if (budgetResult.error) {
    throw new Error(`Failed to load budgets: ${budgetResult.error.message}`);
  }
  if (appointmentsResult.error) {
    throw new Error(
      `Failed to load appointments: ${appointmentsResult.error.message}`,
    );
  }
  if (feedbackResult.error) {
    throw new Error(`Failed to load feedback: ${feedbackResult.error.message}`);
  }
  if (discoverResult.error) {
    throw new Error(
      `Failed to load discover profiles: ${discoverResult.error.message}`,
    );
  }

  const shieldByClient = new Map<
    string,
    { score: number | null; rating: ShieldRating | null; computedAt: string | null }
  >();
  for (const row of (shieldResult.data ?? []) as Array<{
    client_id: string;
    adjusted_shield_score: number | string;
    rating: ShieldRating;
    computed_at: string;
  }>) {
    shieldByClient.set(row.client_id, {
      score: toNumber(row.adjusted_shield_score),
      rating: row.rating,
      computedAt: row.computed_at,
    });
  }

  const documentCountByClient = new Map<string, number>();
  const latestDocumentByClient = new Map<string, string>();
  for (const row of (documentsResult.data ?? []) as Array<{
    client_id: string;
    created_at: string;
  }>) {
    documentCountByClient.set(
      row.client_id,
      (documentCountByClient.get(row.client_id) ?? 0) + 1,
    );
    if (!latestDocumentByClient.has(row.client_id)) {
      latestDocumentByClient.set(row.client_id, row.created_at);
    }
  }

  const budgetSaved = new Set(
    ((budgetResult.data ?? []) as Array<{ client_id: string }>).map(
      (row) => row.client_id,
    ),
  );

  const nextAppointmentByClient = new Map<string, string>();
  for (const row of (appointmentsResult.data ?? []) as Array<{
    client_id: string;
    starts_at: string;
  }>) {
    if (!nextAppointmentByClient.has(row.client_id)) {
      nextAppointmentByClient.set(row.client_id, row.starts_at);
    }
  }

  const feedbackStatusByClient = new Map<string, string>();
  for (const row of (feedbackResult.data ?? []) as Array<{
    client_id: string;
    status: string;
  }>) {
    if (!feedbackStatusByClient.has(row.client_id)) {
      feedbackStatusByClient.set(row.client_id, row.status);
    }
  }

  const discoverCompletedByClient = new Map<string, string | null>();
  for (const row of (discoverResult.data ?? []) as Array<{
    client_id: string;
    completed_at: string | null;
  }>) {
    discoverCompletedByClient.set(row.client_id, row.completed_at);
  }

  const listItems: MyClientsListItem[] = clients.map((client) => {
    const shield = shieldByClient.get(client.id);
    return {
      id: client.id,
      displayName: client.display_name,
      email: client.email,
      status: client.status,
      onboardingStep: client.onboarding_step,
      nextReviewDue: client.next_review_due,
      reviewDue: isReviewDue(client),
      adjustedShieldScore: shield?.score ?? null,
      rating: shield?.rating ?? null,
      lastActivityDate: maxIsoDate(
        client.updated_at,
        shield?.computedAt,
        discoverCompletedByClient.get(client.id),
        latestDocumentByClient.get(client.id),
      ),
      documentCount: documentCountByClient.get(client.id) ?? 0,
      budgetSaved: budgetSaved.has(client.id),
      upcomingAppointmentAt: nextAppointmentByClient.get(client.id) ?? null,
      feedbackStatus: feedbackStatusByClient.get(client.id) ?? null,
    };
  });

  return {
    clients: listItems,
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}

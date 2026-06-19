import "server-only";

import {
  getClientEntitlements,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { loadCurrentPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import { assessOutputStaleness } from "@/lib/compliance/staleOutputPolicy";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";
import { parsePublishedSafePayload } from "@/lib/compliance/publicationWorkflow";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

export type ActiveClientPortalShell = {
  welcomeName: string;
  clientDisplayName: string;
  adviserName: string | null;
  adviserFirm: string | null;
  nextAppointment: {
    startsAt: string;
    meetingFormat: string | null;
  } | null;
  outstandingClientTask: {
    label: string;
    href: string;
  } | null;
  lastReviewedDate: string | null;
  planStatus: string;
  dataAsAt: string | null;
  reviewRecommended: boolean;
  navHrefs: string[];
};

export async function loadActiveClientPortalShell(input: {
  user: AppUserRow;
  client: AppClientRow;
}): Promise<ActiveClientPortalShell> {
  const ctx = await getUserExperienceContext({
    user: input.user,
    client: input.client,
  });
  const entitlements = await getClientEntitlements(ctx);

  const published = await loadCurrentPublishedOutput(
    input.client.id,
    "financial_overview",
    "client_published",
  );

  let lastReviewedDate: string | null = null;
  let dataAsAt: string | null = null;
  let reviewRecommended = false;
  let planStatus = "Your adviser is reviewing your plan";

  if (published) {
    const payload = parsePublishedSafePayload(published);
    lastReviewedDate = payload.lastReviewedDate ?? published.published_at;
    dataAsAt = payload.dataAsAt;
    const stale = assessOutputStaleness({
      outputType: "financial_overview",
      dataAsAt: payload.dataAsAt,
      publishedAt: published.published_at,
      expiresAt: published.expires_at,
    });
    reviewRecommended = stale.reviewRecommended;
    planStatus = reviewRecommended
      ? "Review recommended"
      : "Adviser-reviewed summary on file";
  }

  const adviserUserId = input.client.advisor_user_id;
  let adviserName: string | null = null;
  let adviserFirm: string | null = null;

  if (adviserUserId) {
    const admin = createAdminSupabaseClient();
    const { data: adviserUser } = await admin
      .from("users")
      .select("full_name, organisation")
      .eq("id", adviserUserId)
      .maybeSingle();

    const { data: adviserProfile } = await admin
      .from("adviser_profiles")
      .select("display_name, organisation, representing_insurer")
      .eq("adviser_user_id", adviserUserId)
      .maybeSingle();

    const profile = adviserProfile as {
      display_name?: string | null;
      organisation?: string | null;
      representing_insurer?: string | null;
    } | null;
    const user = adviserUser as {
      full_name?: string | null;
      organisation?: string | null;
    } | null;

    adviserName =
      profile?.display_name?.trim() || user?.full_name?.trim() || null;
    adviserFirm =
      profile?.organisation?.trim() ||
      profile?.representing_insurer?.trim() ||
      user?.organisation?.trim() ||
      null;
  }

  const appointment = await loadNextClientAppointment(
    input.client.id,
    input.user.id,
  );
  const outstandingClientTask = await loadOutstandingClientTask(input.client.id);

  const welcomeName =
    input.client.display_name?.split(" ")[0] ??
    input.user.full_name?.split(" ")[0] ??
    "there";

  if (!published) {
    planStatus = CLIENT_TERMINOLOGY.noPublishedSummary;
  }

  return {
    welcomeName,
    clientDisplayName: input.client.display_name ?? input.user.full_name ?? "Client",
    adviserName,
    adviserFirm,
    nextAppointment: appointment,
    outstandingClientTask,
    lastReviewedDate,
    planStatus,
    dataAsAt,
    reviewRecommended,
    navHrefs: entitlements.navHrefs,
  };
}

async function loadNextClientAppointment(
  clientId: string,
  clientUserId: string,
): Promise<{ startsAt: string; meetingFormat: string | null } | null> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("adviser_appointments")
    .select("starts_at, appointment_type")
    .eq("client_id", clientId)
    .eq("client_user_id", clientUserId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as { starts_at: string; appointment_type: string | null };
  return {
    startsAt: row.starts_at,
    meetingFormat: row.appointment_type,
  };
}

async function loadOutstandingClientTask(
  clientId: string,
): Promise<{ label: string; href: string } | null> {
  const admin = createAdminSupabaseClient();

  const { data } = await admin
    .from("roadmap_items")
    .select("title, item_key")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .eq("client_visible", true)
    .eq("task_owner", "client")
    .in("status", ["not_started", "in_progress"])
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as { title: string; item_key: string };
  return {
    label: row.title,
    href: "/roadmap",
  };
}

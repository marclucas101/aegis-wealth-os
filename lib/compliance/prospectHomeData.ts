import "server-only";

import { overallProfileCompleteness } from "@/lib/aegis/prospectProfileSections";
import {
  getUserExperienceContext,
  getClientEntitlements,
} from "@/lib/compliance/entitlements";
import {
  resolveProspectJourneyStatus,
  resolveProspectPrimaryCta,
  prospectStatusLabel,
} from "@/lib/compliance/prospectJourney";
import { loadCurrentPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import { resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import { listClientDocuments } from "@/lib/supabase/documentPersistence";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

export type ProspectHomeData = {
  welcomeName: string;
  relationshipStage: string;
  journeyStatus: string;
  journeyStatusKey: string;
  profileCompletenessPercent: number;
  hasDiscoverData: boolean;
  hasAssignedAdviser: boolean;
  adviserName: string | null;
  adviserFirm: string | null;
  upcomingAppointment: {
    startsAt: string;
    meetingFormat: string | null;
  } | null;
  adviserReviewStatus: string;
  documentRequestCount: number;
  primaryCta: { label: string; href: string };
  hasPublishedSnapshot: boolean;
  entitlements: { navHrefs: string[] };
};

export async function loadProspectHomeData(input: {
  user: AppUserRow;
  client: AppClientRow;
}): Promise<ProspectHomeData> {
  const stage = resolveRelationshipStage(input.client);
  const ctx = await getUserExperienceContext({
    user: input.user,
    client: input.client,
  });
  const entitlements = await getClientEntitlements(ctx);

  const discover = await loadCurrentDiscoverProfile(input.client.id);
  const completeness = discover?.completeness ?? null;
  const profileCompletenessPercent = completeness
    ? Math.round(overallProfileCompleteness(completeness))
    : 0;

  const published = await loadCurrentPublishedOutput(
    input.client.id,
    "financial_readiness_snapshot",
    "client_published",
  );

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
      profile?.display_name?.trim() ||
      user?.full_name?.trim() ||
      null;
    adviserFirm =
      profile?.organisation?.trim() ||
      profile?.representing_insurer?.trim() ||
      user?.organisation?.trim() ||
      null;
  }

  const appointment = await loadNextClientAppointment(input.client.id, input.user.id);

  const documents = await listClientDocuments(input.client, null, {
    prospectMode: true,
    clientUserId: input.user.id,
  });

  const journeyCtx = {
    stage,
    hasDiscoverData: Boolean(discover),
    profileCompletenessPercent,
    hasAssignedAdviser: Boolean(input.client.advisor_user_id),
    hasUpcomingAppointment: Boolean(appointment),
    hasPublishedSnapshot: Boolean(published),
    hasOpenDocumentRequests: false,
  };

  const journeyStatusKey = resolveProspectJourneyStatus(journeyCtx);
  const primaryCta = resolveProspectPrimaryCta(journeyCtx);

  const welcomeName =
    input.client.display_name?.split(" ")[0] ??
    input.user.full_name?.split(" ")[0] ??
    "there";

  let adviserReviewStatus = "Not yet submitted";
  if (journeyStatusKey === "submitted_for_review") {
    adviserReviewStatus = "Awaiting adviser review";
  } else if (journeyStatusKey === "meeting_scheduled") {
    adviserReviewStatus = "Meeting scheduled";
  } else if (journeyStatusKey === "adviser_review_completed") {
    adviserReviewStatus = "Adviser review completed";
  } else if (journeyStatusKey === "profile_in_progress") {
    adviserReviewStatus = "Profile in progress";
  }

  return {
    welcomeName,
    relationshipStage: stage,
    journeyStatus: prospectStatusLabel(journeyStatusKey),
    journeyStatusKey,
    profileCompletenessPercent,
    hasDiscoverData: Boolean(discover),
    hasAssignedAdviser: Boolean(input.client.advisor_user_id),
    adviserName,
    adviserFirm,
    upcomingAppointment: appointment
      ? {
          startsAt: appointment.startsAt,
          meetingFormat: appointment.meetingFormat,
        }
      : null,
    adviserReviewStatus,
    documentRequestCount: documents.length,
    primaryCta: { label: primaryCta.label, href: primaryCta.href },
    hasPublishedSnapshot: Boolean(published),
    entitlements: { navHrefs: entitlements.navHrefs },
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

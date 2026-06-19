import "server-only";

import { overallProfileCompleteness } from "@/lib/aegis/prospectProfileSections";
import { MEETING_PREP_QUESTIONS } from "@/lib/compliance/prospectJourney";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import { listClientDocuments } from "@/lib/supabase/documentPersistence";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadAdviserUserAndProfile, mapToPublicProfile } from "@/lib/supabase/adviserProfilePersistence";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

export type MeetingPreparationData = {
  appointment: {
    startsAt: string;
    endsAt: string | null;
    meetingFormat: string | null;
    status: string;
  } | null;
  adviser: {
    displayName: string | null;
    professionalTitle: string | null;
    organisation: string | null;
    representingInsurer: string | null;
    phone: string | null;
    photoUrl: string | null;
  } | null;
  documentsToPrepare: string[];
  incompleteSections: string[];
  educationalQuestions: readonly string[];
  profileCompletenessPercent: number;
  canUpdateProfile: boolean;
  bookingHref: string;
};

const DOCUMENT_PREP_GUIDANCE = [
  "Recent insurance policy statements",
  "Investment account summaries (if comfortable sharing)",
  "CPF statements or retirement plan documents",
  "Identity documents if requested by your adviser",
];

export async function loadMeetingPreparationData(input: {
  user: AppUserRow;
  client: AppClientRow;
}): Promise<MeetingPreparationData> {
  const discover = await loadCurrentDiscoverProfile(input.client.id);
  const completeness = discover?.completeness ?? null;
  const profileCompletenessPercent = completeness
    ? Math.round(overallProfileCompleteness(completeness))
    : 0;

  const incompleteSections: string[] = [];
  if (completeness) {
    if (completeness.personalInfo < 60) incompleteSections.push("Personal details");
    if (completeness.income < 40) incompleteSections.push("Income overview");
    if (completeness.expenses < 30) incompleteSections.push("Monthly commitments");
    if (completeness.policies < 30) incompleteSections.push("Insurance arrangements");
  }

  const appointment = await loadNextAppointmentDetail(
    input.client.id,
    input.user.id,
  );

  let adviser: MeetingPreparationData["adviser"] = null;
  if (input.client.advisor_user_id) {
    const { user, profile } = await loadAdviserUserAndProfile(
      input.client.advisor_user_id,
    );
    if (user) {
      const publicProfile = await mapToPublicProfile(
        input.client.advisor_user_id,
        user,
        profile,
      );
      adviser = {
        displayName: publicProfile.displayName,
        professionalTitle: publicProfile.professionalTitle,
        organisation: publicProfile.organisation,
        representingInsurer: publicProfile.representingInsurer,
        phone: publicProfile.phone,
        photoUrl: publicProfile.photoUrl,
      };
    }
  }

  const documents = await listClientDocuments(input.client, null, {
    prospectMode: true,
    clientUserId: input.user.id,
  });

  const documentsToPrepare =
    documents.length > 0
      ? DOCUMENT_PREP_GUIDANCE
      : DOCUMENT_PREP_GUIDANCE;

  return {
    appointment,
    adviser,
    documentsToPrepare,
    incompleteSections,
    educationalQuestions: MEETING_PREP_QUESTIONS,
    profileCompletenessPercent,
    canUpdateProfile: true,
    bookingHref: "/my-adviser",
  };
}

async function loadNextAppointmentDetail(
  clientId: string,
  clientUserId: string,
): Promise<MeetingPreparationData["appointment"]> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("adviser_appointments")
    .select("starts_at, ends_at, appointment_type, status")
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

  const row = data as {
    starts_at: string;
    ends_at: string | null;
    appointment_type: string | null;
    status: string;
  };

  return {
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    meetingFormat: row.appointment_type,
    status: row.status,
  };
}

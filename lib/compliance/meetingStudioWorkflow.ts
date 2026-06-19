import "server-only";

import { overallProfileCompleteness } from "@/lib/aegis/prospectProfileSections";
import {
  EDUCATIONAL_LABEL,
  ILLUSTRATION_LABEL,
  sanitizeMeetingPresentationDto,
  type MeetingPresentationDto,
  type PresentationSectionPayload,
} from "@/lib/compliance/meetingPresentationDtos";
import {
  assertClientAcknowledgementsEnabled,
  assertMeetingStudioEnabled,
  assertPresentationModeEnabled,
  isExactAmountPresentationEnabled,
} from "@/lib/compliance/meetingStudioAccess";
import { sanitizeMeetingAuditMetadata } from "@/lib/compliance/meetingAuditMetadata";
import { sanitizeCloseStatePatch } from "@/lib/compliance/meetingCloseState";
import { confirmMeetingFact } from "@/lib/compliance/meetingFactConfirmation";
import { maybeAdvanceStageOnMeetingCompletion } from "@/lib/compliance/meetingStageTransition";
import {
  assertStatusTransition,
  normalizeSectionOrder,
  normalizeSelectedSections,
} from "@/lib/compliance/meetingSessionLifecycle";
import {
  ACKNOWLEDGEMENT_ITEMS,
  DEFAULT_PRESENTATION_ORDER,
  STRESS_SCENARIO_LABELS,
  type AcknowledgementRecord,
  type CloseState,
  type MeetingSectionType,
  type MeetingSessionStatus,
  type MeetingType,
  type PreparationState,
  type ScenarioSelection,
} from "@/lib/compliance/meetingStudioTypes";
import { resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { loadDashboardSnapshot } from "@/lib/supabase/dashboardQueries";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import { dbLoadClientRelationshipStage } from "@/lib/supabase/compliancePublication";
import {
  dbInsertMeetingSession,
  dbInsertMeetingSessionEvent,
  dbListMeetingSessionsForClient,
  dbLoadAdviserDisplayName,
  dbLoadClientDisplayName,
  dbLoadMeetingSessionById,
  dbUpdateMeetingSession,
  dbValidateAppointmentForClient,
  type MeetingSessionRow,
} from "@/lib/supabase/meetingSessionPersistence";
import type { AppClientRow } from "@/lib/supabase/userProfile";

const ALGORITHM_VERSION = "phase9c-v1";

const IMMUTABLE_STATUSES: MeetingSessionStatus[] = ["completed", "archived"];

export const ANALYSIS_REFRESH_POLICY =
  "Presentation may continue with a visible stale-analysis warning; affected quantitative sections use session snapshot data-as-at only." as const;

export type MeetingPreparationContext = {
  clientName: string;
  relationshipStage: string;
  profileCompletenessPercent: number;
  missingInformation: string[];
  appointmentId: string | null;
  publicationCount: number;
  dataQualityWarnings: string[];
  confirmableFacts: Array<{
    fieldKey: string;
    label: string;
    currentValue: string | null;
  }>;
};

function assertSessionMutable(session: MeetingSessionRow): void {
  if (IMMUTABLE_STATUSES.includes(session.status)) {
    throw new Error("Completed sessions cannot be modified");
  }
}

function assertSessionOwnedByAdviser(
  session: MeetingSessionRow,
  adviserUserId: string,
  isAdmin: boolean,
): void {
  if (!isAdmin && session.adviser_user_id !== adviserUserId) {
    throw new Error("Session not accessible");
  }
}

export async function assertMeetingSessionAccess(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  clientId: string;
  sessionId: string;
}): Promise<{ client: AppClientRow; session: MeetingSessionRow }> {
  const resolved = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.clientId,
  );

  if (resolved.status !== "ok") {
    throw new Error(resolved.status);
  }

  const session = await dbLoadMeetingSessionById(input.sessionId);
  if (!session || session.client_id !== input.clientId) {
    throw new Error("not_found");
  }

  assertSessionOwnedByAdviser(
    session,
    input.authUserId,
    input.userRole === "admin",
  );

  if (
    input.userRole === "advisor" &&
    resolved.client.advisor_user_id !== input.authUserId
  ) {
    throw new Error("forbidden");
  }

  return { client: resolved.client, session };
}

export async function createMeetingSession(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingType?: MeetingType;
  title?: string;
  purpose?: string;
  appointmentId?: string | null;
  scheduledStart?: string | null;
}): Promise<MeetingSessionRow> {
  await assertMeetingStudioEnabled();

  const resolved = await resolveAccessibleClient(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );

  if (resolved.status !== "ok") {
    throw new Error(resolved.status);
  }

  if (
    input.userRole === "advisor" &&
    resolved.client.advisor_user_id !== input.adviserUserId
  ) {
    throw new Error("forbidden");
  }

  if (input.appointmentId) {
    const validation = await dbValidateAppointmentForClient({
      appointmentId: input.appointmentId,
      clientId: input.clientId,
      adviserUserId: resolved.client.advisor_user_id ?? input.adviserUserId,
    });
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
  }

  const relationshipStage = resolveRelationshipStage(resolved.client);
  const discover = await loadCurrentDiscoverProfile(input.clientId);

  const session = await dbInsertMeetingSession({
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    appointment_id: input.appointmentId ?? null,
    meeting_type: input.meetingType ?? "review",
    status: "draft",
    title: input.title ?? null,
    purpose: input.purpose ?? null,
    scheduled_start: input.scheduledStart ?? null,
    selected_sections: [],
    section_order: [...DEFAULT_PRESENTATION_ORDER],
    relationship_stage_at_start: relationshipStage,
    data_snapshot_version: discover?.completedAt ?? null,
    algorithm_version: ALGORITHM_VERSION,
  });

  await dbInsertMeetingSessionEvent({
    session_id: session.id,
    client_id: session.client_id,
    adviser_user_id: input.adviserUserId,
    event_type: "session_created",
    metadata: { meetingType: session.meeting_type },
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.adviserUserId,
    action: "meeting_session_created",
    entityType: "meeting_session",
    entityId: session.id,
    metadata: sanitizeMeetingAuditMetadata({ meetingType: session.meeting_type }),
  });

  return session;
}

export async function listMeetingSessions(
  clientId: string,
): Promise<MeetingSessionRow[]> {
  return dbListMeetingSessionsForClient(clientId);
}

export async function saveMeetingPreparation(input: {
  session: MeetingSessionRow;
  clientId: string;
  adviserUserId: string;
  selectedSections: MeetingSectionType[];
  sectionOrder?: MeetingSectionType[];
  preparationState?: PreparationState;
  title?: string;
  purpose?: string;
}): Promise<MeetingSessionRow> {
  await assertMeetingStudioEnabled();
  assertSessionMutable(input.session);

  const selectedSections = normalizeSelectedSections(
    input.selectedSections as unknown as string[],
  );
  const sectionOrder = input.sectionOrder
    ? normalizeSectionOrder(
        input.sectionOrder as unknown as string[],
        selectedSections,
      )
    : input.session.section_order;

  const nextStatus: MeetingSessionStatus =
    input.session.status === "draft" ? "prepared" : input.session.status;
  assertStatusTransition(input.session.status, nextStatus);

  const session = await dbUpdateMeetingSession(
    input.session.id,
    input.clientId,
    {
      selected_sections: selectedSections,
      section_order: sectionOrder,
      preparation_state: input.preparationState ?? input.session.preparation_state,
      title: input.title ?? input.session.title,
      purpose: input.purpose ?? input.session.purpose,
      status: nextStatus,
    },
    { expectedStatus: input.session.status },
  );

  await dbInsertMeetingSessionEvent({
    session_id: session.id,
    client_id: session.client_id,
    adviser_user_id: input.adviserUserId,
    event_type: "preparation_saved",
    metadata: sanitizeMeetingAuditMetadata({
      sectionCount: selectedSections.length,
      sectionTypes: selectedSections,
    }),
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.adviserUserId,
    action: "meeting_preparation_saved",
    entityType: "meeting_session",
    entityId: session.id,
    metadata: sanitizeMeetingAuditMetadata({
      sectionCount: selectedSections.length,
    }),
  });

  return session;
}

export async function startMeetingSession(input: {
  session: MeetingSessionRow;
  clientId: string;
  adviserUserId: string;
}): Promise<MeetingSessionRow> {
  await assertMeetingStudioEnabled();

  if (input.session.status === "in_progress") {
    return input.session;
  }

  if (input.session.status !== "prepared") {
    throw new Error("Session must be prepared before starting");
  }

  assertStatusTransition(input.session.status, "in_progress");

  const now = new Date().toISOString();
  const session = await dbUpdateMeetingSession(
    input.session.id,
    input.clientId,
    {
      status: "in_progress",
      started_at: input.session.started_at ?? now,
    },
    { expectedStatus: "prepared" },
  );

  await dbInsertMeetingSessionEvent({
    session_id: session.id,
    client_id: session.client_id,
    adviser_user_id: input.adviserUserId,
    event_type: "meeting_started",
    metadata: sanitizeMeetingAuditMetadata({ startedAt: now }),
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.adviserUserId,
    action: "meeting_started",
    entityType: "meeting_session",
    entityId: session.id,
  });

  return session;
}

function mapShieldRatingToStrength(
  rating: string,
): "strong" | "moderate" | "area_for_discussion" {
  if (rating === "strong" || rating === "comprehensive") {
    return "strong";
  }
  if (rating === "moderate" || rating === "developing") {
    return "moderate";
  }
  return "area_for_discussion";
}

async function buildSectionPayload(
  sectionType: MeetingSectionType,
  session: MeetingSessionRow,
  client: AppClientRow,
  options: { exactAmounts: boolean },
): Promise<PresentationSectionPayload | null> {
  const snapshot = await loadDashboardSnapshot(client);
  const discover = await loadCurrentDiscoverProfile(client.id);
  const closeState = session.close_state;
  const formData = (discover?.formData ?? {}) as Record<string, unknown>;

  const educationalLabel = EDUCATIONAL_LABEL;

  switch (sectionType) {
    case "welcome":
      return {
        sectionType: "welcome",
        heading: "Welcome",
        educationalLabel,
        purpose: session.purpose,
      };

    case "priorities": {
      const goals: string[] = [];
      const business = formData.business as Record<string, unknown> | undefined;
      if (business?.primaryGoal) goals.push(String(business.primaryGoal));
      if (business?.secondaryGoal) goals.push(String(business.secondaryGoal));
      return {
        sectionType: "priorities",
        heading: "Your priorities",
        educationalLabel,
        goals: goals.length > 0 ? goals : ["Based on information provided"],
        timeHorizons: business?.timeHorizon
          ? [String(business.timeHorizon)]
          : [],
      };
    }

    case "facts_and_assumptions": {
      const { loadConfirmableFacts } = await import(
        "@/lib/compliance/meetingFactConfirmation"
      );
      const facts = await loadConfirmableFacts(client.id);
      const confirmed = new Map(
        session.fact_confirmations.map((f) => [f.fieldKey, f.status]),
      );
      return {
        sectionType: "facts_and_assumptions",
        heading: "Facts and assumptions",
        educationalLabel,
        facts: facts.map((f) => ({
          label: f.label,
          value: f.currentValue,
          status: confirmed.get(f.fieldKey) ?? "unchanged",
        })),
      };
    }

    case "financial_foundation":
      if (!snapshot) {
        return {
          sectionType: "financial_foundation",
          heading: "Financial foundation",
          educationalLabel,
          cashFlowPosition: "Based on information provided",
          emergencyFundRunway: null,
          debtOverview: null,
          monthlyCommitments: null,
          goalContributionCapacity: null,
          educationalRatios: [],
        };
      }
      return {
        sectionType: "financial_foundation",
        heading: "Financial foundation",
        educationalLabel,
        cashFlowPosition: "Current position — based on information provided",
        emergencyFundRunway: null,
        debtOverview: "Area for discussion — debt overview",
        monthlyCommitments: "Based on information provided",
        goalContributionCapacity: "Educational illustration",
        educationalRatios: [
          {
            label: "Information completeness",
            value: `${Math.round((snapshot.dataConfidenceFactor ?? 0.5) * 100)}%`,
            context: "Based on information provided",
          },
        ],
      };

    case "broad_strengths":
      return {
        sectionType: "broad_strengths",
        heading: "Broad strengths",
        educationalLabel,
        strengths: snapshot?.insights?.strongestPillar
          ? [`Strength in ${snapshot.insights.strongestPillar} area`]
          : ["Based on information provided"],
      };

    case "areas_for_review":
      return {
        sectionType: "areas_for_review",
        heading: "Areas requiring discussion",
        educationalLabel,
        areas: snapshot?.insights?.weakestPillar
          ? [`Area for discussion: ${snapshot.insights.weakestPillar}`]
          : ["Areas to explore with your adviser"],
      };

    case "protection_resilience": {
      const categories = [];
      if (snapshot?.shield) {
        categories.push({
          category: "Overall protection position",
          relativeStrength: mapShieldRatingToStrength(snapshot.shield.rating),
          explanation: "Based on information provided — adviser observation",
          exactAmountIllustration: options.exactAmounts
            ? "Adviser-led illustration — see meeting notes"
            : null,
        });
      }
      return {
        sectionType: "protection_resilience",
        heading: "Protection and resilience",
        educationalLabel,
        categories,
        assumptions: ["Based on information provided"],
      };
    }

    case "scenario_education": {
      const scenarios = session.scenario_selections.map((s) => ({
        label: s.label,
        assumption: "Educational assumption — adviser-led discussion",
        illustration: ILLUSTRATION_LABEL,
        adviserExplanation: s.adviserExplanation,
      }));
      return {
        sectionType: "scenario_education",
        heading: "Scenario education",
        educationalLabel,
        scenarios,
      };
    }

    case "goal_alignment":
      return {
        sectionType: "goal_alignment",
        heading: "Goal alignment",
        educationalLabel,
        alignedGoals: closeState.agreedPriorities ?? [],
        discussionPoints: closeState.deferredTopics ?? [],
      };

    case "adviser_observations":
      return {
        sectionType: "adviser_observations",
        heading: "Adviser observations",
        educationalLabel,
        observations: closeState.meetingVisibleObservations ?? [],
      };

    case "agreed_priorities":
      return {
        sectionType: "agreed_priorities",
        heading: "Agreed priorities",
        educationalLabel,
        priorities: closeState.agreedPriorities ?? [],
        deferredTopics: closeState.deferredTopics ?? [],
      };

    case "next_steps":
      return {
        sectionType: "next_steps",
        heading: "Next steps",
        educationalLabel,
        clientTasks: closeState.administrativeNextSteps ?? [],
        adviserTasks: [],
        nextAppointment: null,
        administrativeSteps: closeState.administrativeNextSteps ?? [],
      };

    default:
      return null;
  }
}

export async function buildMeetingPresentation(
  session: MeetingSessionRow,
  client: AppClientRow,
): Promise<MeetingPresentationDto> {
  await assertPresentationModeEnabled();

  if (
    session.status !== "prepared" &&
    session.status !== "in_progress" &&
    session.status !== "completed"
  ) {
    throw new Error("Presentation requires prepared or in-progress session");
  }

  const selectedSet = new Set(session.selected_sections);
  const order =
    session.section_order.length > 0
      ? session.section_order
      : [...DEFAULT_PRESENTATION_ORDER];

  const exactAmounts = await isExactAmountPresentationEnabled();
  const sections: PresentationSectionPayload[] = [];

  for (const sectionType of order) {
    if (sectionType === "welcome" || selectedSet.has(sectionType)) {
      const payload = await buildSectionPayload(
        sectionType,
        session,
        client,
        { exactAmounts },
      );
      if (payload) {
        sections.push(payload);
      }
    }
  }

  const [clientName, adviserName] = await Promise.all([
    dbLoadClientDisplayName(client.id),
    dbLoadAdviserDisplayName(session.adviser_user_id),
  ]);

  const dto: MeetingPresentationDto = {
    sessionId: session.id,
    clientName,
    adviserName,
    meetingDate: session.scheduled_start ?? session.started_at,
    dataAsAt: session.data_snapshot_version ?? new Date().toISOString(),
    meetingPurpose: session.purpose,
    adviserLedLabel: EDUCATIONAL_LABEL,
    staleAnalysisWarning: session.requires_analysis_refresh
      ? "Based on earlier information — internal analysis refresh recommended"
      : null,
    sections,
    algorithmVersion: session.algorithm_version ?? ALGORITHM_VERSION,
  };

  return sanitizeMeetingPresentationDto(
    dto as unknown as Record<string, unknown>,
  );
}

export async function getPresentationSection(
  session: MeetingSessionRow,
  client: AppClientRow,
  sectionType: MeetingSectionType,
): Promise<PresentationSectionPayload> {
  if (
    sectionType !== "welcome" &&
    !session.selected_sections.includes(sectionType)
  ) {
    throw new Error("Section not available");
  }

  if (
    sectionType === "scenario_education" &&
    session.scenario_selections.length === 0
  ) {
    throw new Error("Section not available");
  }

  const exactAmounts = await isExactAmountPresentationEnabled();
  const payload = await buildSectionPayload(sectionType, session, client, {
    exactAmounts,
  });

  if (!payload) {
    throw new Error("Section not available");
  }

  return payload;
}

export async function recordSectionShown(input: {
  session: MeetingSessionRow;
  clientId: string;
  adviserUserId: string;
  sectionType: MeetingSectionType;
  skipped?: boolean;
}): Promise<MeetingSessionRow> {
  await assertPresentationModeEnabled();

  if (
    input.sectionType !== "welcome" &&
    !input.session.selected_sections.includes(input.sectionType)
  ) {
    throw new Error("Section not selected");
  }

  const shown = new Set(input.session.sections_shown);
  const skipped = new Set(input.session.skipped_sections);
  const wasAlreadyShown = shown.has(input.sectionType);
  const wasAlreadySkipped = skipped.has(input.sectionType);

  if (input.skipped) {
    skipped.add(input.sectionType);
  } else {
    shown.add(input.sectionType);
  }

  const session = await dbUpdateMeetingSession(
    input.session.id,
    input.clientId,
    {
      sections_shown: [...shown],
      skipped_sections: [...skipped],
    },
  );

  if (!wasAlreadyShown && !wasAlreadySkipped) {
    await dbInsertMeetingSessionEvent({
      session_id: session.id,
      client_id: session.client_id,
      adviser_user_id: input.adviserUserId,
      event_type: input.skipped ? "section_skipped" : "section_shown",
      section_type: input.sectionType,
      metadata: sanitizeMeetingAuditMetadata({ sectionType: input.sectionType }),
    });

    await writeAuditLog({
      clientId: input.clientId,
      userId: input.adviserUserId,
      action: input.skipped ? "meeting_section_skipped" : "meeting_section_shown",
      entityType: "meeting_session",
      entityId: session.id,
      metadata: sanitizeMeetingAuditMetadata({ sectionType: input.sectionType }),
    });
  }

  return session;
}

export async function selectScenarios(input: {
  session: MeetingSessionRow;
  clientId: string;
  adviserUserId: string;
  scenarioKeys: string[];
  explanations?: Record<string, string>;
}): Promise<MeetingSessionRow> {
  assertSessionMutable(input.session);

  const selections: ScenarioSelection[] = [];
  for (const key of input.scenarioKeys) {
    if (!(key in STRESS_SCENARIO_LABELS)) {
      throw new Error(`Unknown scenario: ${key}`);
    }
    selections.push({
      scenarioKey: key,
      label: STRESS_SCENARIO_LABELS[key as keyof typeof STRESS_SCENARIO_LABELS],
      adviserExplanation: input.explanations?.[key] ?? null,
      selectedAt: new Date().toISOString(),
      selectedByUserId: input.adviserUserId,
    });
  }

  const session = await dbUpdateMeetingSession(input.session.id, input.clientId, {
    scenario_selections: selections,
  });

  for (const selection of selections) {
    await dbInsertMeetingSessionEvent({
      session_id: session.id,
      client_id: session.client_id,
      adviser_user_id: input.adviserUserId,
      event_type: "scenario_shown",
      section_type: "scenario_education",
      metadata: { scenarioKey: selection.scenarioKey },
    });
  }

  return session;
}

export async function recordAcknowledgement(input: {
  session: MeetingSessionRow;
  clientId: string;
  adviserUserId: string;
  itemKey: string;
  method: "verbal_recorded" | "on_screen";
}): Promise<MeetingSessionRow> {
  await assertClientAcknowledgementsEnabled();
  assertSessionMutable(input.session);

  if (input.session.status !== "in_progress") {
    throw new Error("Acknowledgements can only be recorded during an in-progress meeting");
  }

  const item = ACKNOWLEDGEMENT_ITEMS.find((a) => a.key === input.itemKey);
  if (!item) {
    throw new Error("Unknown acknowledgement item");
  }

  const record: AcknowledgementRecord = {
    itemKey: input.itemKey,
    label: item.label,
    method: input.method,
    recordedByUserId: input.adviserUserId,
    recordedAt: new Date().toISOString(),
    acknowledgementVersion: "phase9c-v1",
  };

  const existing = input.session.acknowledgements.filter(
    (a) => a.itemKey !== input.itemKey,
  );

  const session = await dbUpdateMeetingSession(input.session.id, input.clientId, {
    acknowledgements: [...existing, record],
  });

  await dbInsertMeetingSessionEvent({
    session_id: session.id,
    client_id: session.client_id,
    adviser_user_id: input.adviserUserId,
    event_type: "acknowledgement_recorded",
    metadata: { itemKey: input.itemKey, method: input.method },
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.adviserUserId,
    action: "meeting_acknowledgement_recorded",
    entityType: "meeting_session",
    entityId: session.id,
    metadata: sanitizeMeetingAuditMetadata({
      itemKey: input.itemKey,
      method: input.method,
    }),
  });

  return session;
}

export async function saveCloseState(input: {
  session: MeetingSessionRow;
  clientId: string;
  closeState: CloseState;
}): Promise<MeetingSessionRow> {
  assertSessionMutable(input.session);
  const closeState = sanitizeCloseStatePatch(input.closeState);

  return dbUpdateMeetingSession(input.session.id, input.clientId, {
    close_state: closeState,
  });
}

export async function completeMeetingSession(input: {
  session: MeetingSessionRow;
  client: AppClientRow;
  adviserUserId: string;
  closeState?: CloseState;
}): Promise<{
  session: MeetingSessionRow;
  stageAdvance: { advanced: boolean; previousStage: string; newStage: string };
}> {
  await assertMeetingStudioEnabled();

  if (input.session.status === "completed") {
    const stage = await dbLoadClientRelationshipStage(input.client.id);
    return {
      session: input.session,
      stageAdvance: {
        advanced: false,
        previousStage: stage ?? "prospect",
        newStage: stage ?? "prospect",
      },
    };
  }

  if (input.session.status !== "in_progress") {
    throw new Error("Meeting must be in progress before completion");
  }

  assertStatusTransition(input.session.status, "completed");

  const now = new Date().toISOString();
  const closeState = sanitizeCloseStatePatch(
    input.closeState ?? input.session.close_state,
  );

  const stageAdvance = await maybeAdvanceStageOnMeetingCompletion({
    clientId: input.client.id,
    actorUserId: input.adviserUserId,
    currentStageAtStart: input.session.relationship_stage_at_start,
  });

  const session = await dbUpdateMeetingSession(
    input.session.id,
    input.client.id,
    {
      status: "completed",
      ended_at: input.session.ended_at ?? now,
      completed_at: input.session.completed_at ?? now,
      close_state: closeState,
      relationship_stage_at_end: stageAdvance.newStage,
      sections_shown: input.session.sections_shown,
    },
    { expectedStatus: "in_progress" },
  );

  await dbInsertMeetingSessionEvent({
    session_id: session.id,
    client_id: session.client_id,
    adviser_user_id: input.adviserUserId,
    event_type: "meeting_completed",
    metadata: {
      sectionsShown: session.sections_shown,
      stageAdvanced: stageAdvance.advanced,
    },
  });

  await writeAuditLog({
    clientId: input.client.id,
    userId: input.adviserUserId,
    action: "meeting_completed",
    entityType: "meeting_session",
    entityId: session.id,
    metadata: sanitizeMeetingAuditMetadata({
      sectionsShownCount: session.sections_shown.length,
      stageAdvanced: stageAdvance.advanced,
    }),
  });

  return { session, stageAdvance };
}

export async function prepareMeetingSummary(input: {
  session: MeetingSessionRow;
  client: AppClientRow;
  adviserUserId: string;
}): Promise<MeetingSessionRow> {
  await assertMeetingStudioEnabled();

  if (
    input.session.summary_status === "draft" &&
    Object.keys(input.session.summary_payload).length > 0
  ) {
    return input.session;
  }

  const [clientName, adviserName] = await Promise.all([
    dbLoadClientDisplayName(input.client.id),
    dbLoadAdviserDisplayName(input.adviserUserId),
  ]);

  const closeState = input.session.close_state;
  const summaryPayload = {
    clientName,
    adviserName,
    meetingDate: input.session.started_at ?? input.session.scheduled_start,
    meetingPurpose: input.session.purpose,
    informationConfirmed: input.session.fact_confirmations
      .filter((f) => f.status === "confirmed" || f.status === "corrected")
      .map((f) => f.label),
    broadAreasDiscussed: input.session.sections_shown,
    scenariosReviewed: input.session.scenario_selections.map((s) => s.label),
    agreedPriorities: closeState.agreedPriorities ?? [],
    outstandingInformation: input.session.fact_confirmations
      .filter((f) => f.status === "pending")
      .map((f) => f.label),
    clientTasks: closeState.administrativeNextSteps ?? [],
    adviserTasks: [],
    nextAppointment: closeState.nextAppointmentId ?? null,
    dataAsAt: input.session.data_snapshot_version,
    clientSafeSummaryText: closeState.clientSafeSummaryText ?? null,
    summaryStatus: "draft",
  };

  const session = await dbUpdateMeetingSession(
    input.session.id,
    input.client.id,
    {
      summary_payload: summaryPayload,
      summary_status: "draft",
    },
  );

  await dbInsertMeetingSessionEvent({
    session_id: session.id,
    client_id: session.client_id,
    adviser_user_id: input.adviserUserId,
    event_type: "summary_prepared",
    metadata: { summaryStatus: "draft" },
  });

  await writeAuditLog({
    clientId: input.client.id,
    userId: input.adviserUserId,
    action: "meeting_summary_prepared",
    entityType: "meeting_session",
    entityId: session.id,
    metadata: { summaryStatus: "draft" },
  });

  return session;
}

export async function loadMeetingPreparationContext(
  client: AppClientRow,
): Promise<MeetingPreparationContext> {
  const discover = await loadCurrentDiscoverProfile(client.id);
  const completeness = discover?.completeness ?? null;
  const profileCompletenessPercent = completeness
    ? Math.round(overallProfileCompleteness(completeness))
    : 0;

  const missingInformation: string[] = [];
  if (completeness) {
    if (completeness.personalInfo < 60) missingInformation.push("Personal details");
    if (completeness.income < 40) missingInformation.push("Income overview");
    if (completeness.expenses < 30) missingInformation.push("Monthly commitments");
    if (completeness.policies < 30) missingInformation.push("Insurance arrangements");
  }

  const { loadConfirmableFacts } = await import(
    "@/lib/compliance/meetingFactConfirmation"
  );
  const confirmableFacts = await loadConfirmableFacts(client.id);

  const { listPublishedOutputsForClient } = await import(
    "@/lib/compliance/publicationWorkflow"
  );
  const publications = await listPublishedOutputsForClient(client.id);

  const dataQualityWarnings: string[] = [];
  if (profileCompletenessPercent < 50) {
    dataQualityWarnings.push("Profile less than 50% complete");
  }

  return {
    clientName: client.display_name ?? "Client",
    relationshipStage: resolveRelationshipStage(client),
    profileCompletenessPercent,
    missingInformation,
    appointmentId: null,
    publicationCount: publications.length,
    dataQualityWarnings,
    confirmableFacts,
  };
}

export { confirmMeetingFact };

import "server-only";

import type { AdvisorClientWorkspace } from "./advisorClientQueries";
import { loadAdvisorClientWorkspace } from "./advisorClientQueries";
import type { ClientReviewStatusDetail } from "./advisorReviewPipeline";
import { loadClientReviewStatus } from "./advisorReviewPipeline";
import type { AdvisorTaskRecord } from "./advisorTasks";
import { listAdvisorTasksForClient } from "./advisorTasks";
import type { ClientFileQuality } from "./clientFileQuality";
import { loadClientFileQuality } from "./clientFileQuality";
import type { AdvisorTaskSuggestionsPayload } from "./advisorTaskSuggestions";
import { loadClientTaskSuggestions } from "./advisorTaskSuggestions";
import type { AdvisorNoteRecord } from "./advisorNotesPersistence";
import { listAdvisorNotesForClient } from "./advisorNotesPersistence";

export type AdvisorClientCommandCenterTiming = {
  totalMs: number;
  workspaceMs: number | null;
  reviewMs: number | null;
  fileQualityMs: number | null;
  taskSuggestionsMs: number | null;
  tasksMs: number | null;
  notesMs: number | null;
};

export type AdvisorClientCommandCenterPayload = AdvisorClientWorkspace & {
  review: ClientReviewStatusDetail | null;
  reviewError: string | null;
  fileQuality: ClientFileQuality | null;
  fileQualityError: string | null;
  taskSuggestions: AdvisorTaskSuggestionsPayload | null;
  suggestionsError: string | null;
  tasks: AdvisorTaskRecord[];
  tasksError: string | null;
  notes: AdvisorNoteRecord[];
  notesError: string | null;
  documentsError: string | null;
  reportsError: string | null;
  activityError: string | null;
  viewer: { userId: string; role: "advisor" | "admin" };
  timing: AdvisorClientCommandCenterTiming;
};

export type LoadAdvisorClientCommandCenterResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; payload: AdvisorClientCommandCenterPayload };

type SectionResult<T> =
  | { ok: true; data: T; ms: number }
  | { ok: false; error: string; ms: number };

async function loadSection<T>(
  label: string,
  loader: () => Promise<T>,
): Promise<SectionResult<T>> {
  const started = performance.now();

  try {
    const data = await loader();
    const ms = Math.round(performance.now() - started);
    return { ok: true, data, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const message =
      err instanceof Error ? err.message : `Failed to load ${label}`;

    console.error(`[advisorClientCommandCenter:${label}]`, err);

    return { ok: false, error: message, ms };
  }
}

async function loadReviewSection(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<SectionResult<ClientReviewStatusDetail>> {
  const started = performance.now();

  try {
    const result = await loadClientReviewStatus(authUserId, userRole, clientId);
    const ms = Math.round(performance.now() - started);

    if (!result.ok) {
      return {
        ok: false,
        error: "Unable to load review status for this client.",
        ms,
      };
    }

    return { ok: true, data: result.review, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const message =
      err instanceof Error ? err.message : "Failed to load review status";

    console.error("[advisorClientCommandCenter:review]", err);

    return { ok: false, error: message, ms };
  }
}

async function loadFileQualitySection(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<SectionResult<ClientFileQuality>> {
  const started = performance.now();

  try {
    const result = await loadClientFileQuality(authUserId, userRole, clientId);
    const ms = Math.round(performance.now() - started);

    if (!result.ok) {
      return {
        ok: false,
        error: "Unable to load file quality for this client.",
        ms,
      };
    }

    return { ok: true, data: result.quality, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const message =
      err instanceof Error ? err.message : "Failed to load file quality";

    console.error("[advisorClientCommandCenter:fileQuality]", err);

    return { ok: false, error: message, ms };
  }
}

async function loadSuggestionsSection(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<SectionResult<AdvisorTaskSuggestionsPayload>> {
  const started = performance.now();

  try {
    const result = await loadClientTaskSuggestions(
      authUserId,
      userRole,
      clientId,
    );
    const ms = Math.round(performance.now() - started);

    if (!result.ok) {
      return {
        ok: false,
        error: "Unable to load task suggestions for this client.",
        ms,
      };
    }

    return { ok: true, data: result.payload, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const message =
      err instanceof Error ? err.message : "Failed to load task suggestions";

    console.error("[advisorClientCommandCenter:taskSuggestions]", err);

    return { ok: false, error: message, ms };
  }
}

async function loadTasksSection(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<SectionResult<AdvisorTaskRecord[]>> {
  const started = performance.now();

  try {
    const result = await listAdvisorTasksForClient(
      authUserId,
      userRole,
      clientId,
    );
    const ms = Math.round(performance.now() - started);

    if (!result.ok) {
      return {
        ok: false,
        error: "Unable to load tasks for this client.",
        ms,
      };
    }

    return { ok: true, data: result.tasks, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const message = err instanceof Error ? err.message : "Failed to load tasks";

    console.error("[advisorClientCommandCenter:tasks]", err);

    return { ok: false, error: message, ms };
  }
}

async function loadNotesSection(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<SectionResult<AdvisorNoteRecord[]>> {
  const started = performance.now();

  try {
    const result = await listAdvisorNotesForClient(
      authUserId,
      userRole,
      clientId,
    );
    const ms = Math.round(performance.now() - started);

    if (!result.ok) {
      return {
        ok: false,
        error: "Unable to load notes for this client.",
        ms,
      };
    }

    return { ok: true, data: result.notes, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const message = err instanceof Error ? err.message : "Failed to load notes";

    console.error("[advisorClientCommandCenter:notes]", err);

    return { ok: false, error: message, ms };
  }
}

/**
 * Loads consolidated advisor client workspace data in parallel sections.
 * Workspace access is required; supplementary sections degrade gracefully.
 */
export async function loadAdvisorClientCommandCenter(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<LoadAdvisorClientCommandCenterResult> {
  const totalStarted = performance.now();

  const workspaceResult = await loadSection("workspace", () =>
    loadAdvisorClientWorkspace(authUserId, userRole, clientId),
  );

  if (!workspaceResult.ok) {
    throw new Error(workspaceResult.error);
  }

  const workspaceLoad = workspaceResult.data;

  if (!workspaceLoad.ok) {
    return { ok: false, reason: workspaceLoad.reason };
  }

  const [
    reviewResult,
    fileQualityResult,
    suggestionsResult,
    tasksResult,
    notesResult,
  ] = await Promise.all([
    loadReviewSection(authUserId, userRole, clientId),
    loadFileQualitySection(authUserId, userRole, clientId),
    loadSuggestionsSection(authUserId, userRole, clientId),
    loadTasksSection(authUserId, userRole, clientId),
    loadNotesSection(authUserId, userRole, clientId),
  ]);

  const workspace = workspaceLoad.workspace;

  return {
    ok: true,
    payload: {
      ...workspace,
      review: reviewResult.ok ? reviewResult.data : null,
      reviewError: reviewResult.ok ? null : reviewResult.error,
      fileQuality: fileQualityResult.ok ? fileQualityResult.data : null,
      fileQualityError: fileQualityResult.ok ? null : fileQualityResult.error,
      taskSuggestions: suggestionsResult.ok ? suggestionsResult.data : null,
      suggestionsError: suggestionsResult.ok ? null : suggestionsResult.error,
      tasks: tasksResult.ok ? tasksResult.data : [],
      tasksError: tasksResult.ok ? null : tasksResult.error,
      notes: notesResult.ok ? notesResult.data : [],
      notesError: notesResult.ok ? null : notesResult.error,
      documentsError: null,
      reportsError: null,
      activityError: null,
      viewer: { userId: authUserId, role: userRole },
      timing: {
        totalMs: Math.round(performance.now() - totalStarted),
        workspaceMs: workspaceResult.ms,
        reviewMs: reviewResult.ms,
        fileQualityMs: fileQualityResult.ms,
        taskSuggestionsMs: suggestionsResult.ms,
        tasksMs: tasksResult.ms,
        notesMs: notesResult.ms,
      },
    },
  };
}

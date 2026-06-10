import "server-only";

import type { AdvisorOverview } from "./advisorQueries";
import { loadAdvisorOverview } from "./advisorQueries";
import type {
  AdvisorNotification,
  AdvisorNotificationsPayload,
} from "./advisorNotifications";
import { loadAdvisorNotifications } from "./advisorNotifications";
import type { AdvisorReviewPipeline } from "./advisorReviewPipeline";
import { loadAdvisorReviewPipeline } from "./advisorReviewPipeline";
import type { AdvisorTaskDashboard } from "./advisorTasks";
import { loadAdvisorTaskDashboard } from "./advisorTasks";
import type {
  AdvisorBookFileQuality,
  ClientFileQualitySummary,
} from "./clientFileQuality";
import { loadAdvisorBookFileQuality } from "./clientFileQuality";
import type {
  AdvisorTaskSuggestion,
  AdvisorTaskSuggestionsPayload,
} from "./advisorTaskSuggestions";
import { loadAdvisorTaskSuggestions } from "./advisorTaskSuggestions";
import {
  loadOnboardingClients,
  type OnboardingClientRecord,
} from "./clientOnboarding";

const TOP_NOTIFICATIONS_LIMIT = 8;
const TOP_SUGGESTIONS_LIMIT = 12;

export type AdvisorCommandCenterTiming = {
  totalMs: number;
  overviewMs: number | null;
  notificationsMs: number | null;
  tasksMs: number | null;
  reviewPipelineMs: number | null;
  fileQualityMs: number | null;
  taskSuggestionsMs: number | null;
  onboardingMs: number | null;
};

export type AdvisorCommandCenterPayload = {
  overview: AdvisorOverview;
  notifications: AdvisorNotificationsPayload | null;
  notificationsError: string | null;
  topNotifications: AdvisorNotification[];
  taskDashboard: AdvisorTaskDashboard | null;
  tasksError: string | null;
  reviewPipeline: AdvisorReviewPipeline | null;
  reviewPipelineError: string | null;
  fileQuality: AdvisorBookFileQuality | null;
  fileQualityError: string | null;
  fileQualityByClientId: ClientFileQualitySummary[];
  taskSuggestions: AdvisorTaskSuggestionsPayload | null;
  suggestionsError: string | null;
  topTaskSuggestions: AdvisorTaskSuggestion[];
  onboardingClients: OnboardingClientRecord[];
  onboardingError: string | null;
  viewer: { userId: string; role: "advisor" | "admin" };
  timing: AdvisorCommandCenterTiming;
};

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

    console.error(`[advisorCommandCenter:${label}]`, err);

    return { ok: false, error: message, ms };
  }
}

function selectTopNotifications(
  payload: AdvisorNotificationsPayload,
): AdvisorNotification[] {
  return [...payload.notifications]
    .sort((a, b) => {
      const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
      const rankDiff =
        priorityRank[a.priority] - priorityRank[b.priority];
      if (rankDiff !== 0) return rankDiff;
      return b.detectedAt.localeCompare(a.detectedAt);
    })
    .slice(0, TOP_NOTIFICATIONS_LIMIT);
}

function selectTopTaskSuggestions(
  payload: AdvisorTaskSuggestionsPayload,
): AdvisorTaskSuggestion[] {
  return payload.suggestions.slice(0, TOP_SUGGESTIONS_LIMIT);
}

/**
 * Loads consolidated advisor dashboard data in parallel sections.
 * Each section is isolated so one failure does not block the rest of the console.
 */
export async function loadAdvisorCommandCenter(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorCommandCenterPayload> {
  const totalStarted = performance.now();

  const overviewResult = await loadSection("overview", () =>
    loadAdvisorOverview(authUserId, userRole),
  );

  if (!overviewResult.ok) {
    throw new Error(overviewResult.error);
  }

  const [
    notificationsResult,
    tasksResult,
    reviewPipelineResult,
    fileQualityResult,
    suggestionsResult,
    onboardingResult,
  ] = await Promise.all([
    loadSection("notifications", () =>
      loadAdvisorNotifications(authUserId, userRole),
    ),
    loadSection("tasks", () =>
      loadAdvisorTaskDashboard(authUserId, userRole),
    ),
    loadSection("reviewPipeline", () =>
      loadAdvisorReviewPipeline(authUserId, userRole),
    ),
    loadSection("fileQuality", () =>
      loadAdvisorBookFileQuality(authUserId, userRole),
    ),
    loadSection("taskSuggestions", () =>
      loadAdvisorTaskSuggestions(authUserId, userRole),
    ),
    loadSection("onboarding", () =>
      loadOnboardingClients({
        scope: "advisor",
        advisorUserId: authUserId,
      }),
    ),
  ]);

  const notifications = notificationsResult.ok
    ? notificationsResult.data
    : null;
  const taskDashboard = tasksResult.ok ? tasksResult.data : null;
  const reviewPipeline = reviewPipelineResult.ok
    ? reviewPipelineResult.data
    : null;
  const fileQuality = fileQualityResult.ok ? fileQualityResult.data : null;
  const taskSuggestions = suggestionsResult.ok
    ? suggestionsResult.data
    : null;

  return {
    overview: overviewResult.data,
    notifications,
    notificationsError: notificationsResult.ok
      ? null
      : notificationsResult.error,
    topNotifications: notifications
      ? selectTopNotifications(notifications)
      : [],
    taskDashboard,
    tasksError: tasksResult.ok ? null : tasksResult.error,
    reviewPipeline,
    reviewPipelineError: reviewPipelineResult.ok
      ? null
      : reviewPipelineResult.error,
    fileQuality,
    fileQualityError: fileQualityResult.ok ? null : fileQualityResult.error,
    fileQualityByClientId: fileQuality?.clients ?? [],
    taskSuggestions,
    suggestionsError: suggestionsResult.ok ? null : suggestionsResult.error,
    topTaskSuggestions: taskSuggestions
      ? selectTopTaskSuggestions(taskSuggestions)
      : [],
    onboardingClients: onboardingResult.ok ? onboardingResult.data : [],
    onboardingError: onboardingResult.ok ? null : onboardingResult.error,
    viewer: { userId: authUserId, role: userRole },
    timing: {
      totalMs: Math.round(performance.now() - totalStarted),
      overviewMs: overviewResult.ms,
      notificationsMs: notificationsResult.ms,
      tasksMs: tasksResult.ms,
      reviewPipelineMs: reviewPipelineResult.ms,
      fileQualityMs: fileQualityResult.ms,
      taskSuggestionsMs: suggestionsResult.ms,
      onboardingMs: onboardingResult.ms,
    },
  };
}

import "server-only";

import type { AdvisorOverview } from "./advisorQueries";
import { loadAdvisorOverview } from "./advisorQueries";
import type {
  AdvisorNotification,
  AdvisorNotificationsPayload,
} from "./advisorNotifications";
import { loadAdvisorNotifications } from "./advisorNotifications";
import type { AdvisorReviewPipeline } from "./advisorReviewPipeline";
import {
  buildAdvisorReviewPipelineFromContexts,
  loadAdvisorClientReviewContexts,
} from "./advisorReviewPipeline";
import { ensureBirthdayRemindersForAdviser, generateBirthdayReminders } from "./birthdayReminderTasks";
import type { AdvisorTaskDashboard } from "./advisorTasks";
import { loadAdvisorTaskDashboard } from "./advisorTasks";
import type {
  AdvisorBookFileQuality,
  ClientFileQualitySummary,
} from "./clientFileQuality";
import {
  buildAdvisorBookFileQualityFromContexts,
  loadAdvisorAccessibleClients,
  loadAdvisorClientQualityContexts,
} from "./clientFileQuality";
import type {
  AdvisorTaskSuggestion,
  AdvisorTaskSuggestionsPayload,
} from "./advisorTaskSuggestions";
import {
  DASHBOARD_SUGGESTIONS_LIMIT,
  loadAdvisorTaskSuggestions,
} from "./advisorTaskSuggestions";
import {
  loadOnboardingClients,
  type OnboardingClientRecord,
} from "./clientOnboarding";

const TOP_NOTIFICATIONS_LIMIT = 8;
const HEAVY_SUGGESTIONS_TIME_BUDGET_MS = 3_000;

export type AdvisorCommandCenterShellTiming = {
  totalMs: number;
  overviewMs: number | null;
  onboardingMs: number | null;
};

export type AdvisorCommandCenterHeavyTiming = {
  totalMs: number;
  totalHeavyMs: number;
  notificationsMs: number | null;
  tasksMs: number | null;
  reviewPipelineMs: number | null;
  fileQualityMs: number | null;
  taskSuggestionsMs: number | null;
};

/** @deprecated Use shell + heavy timing types for split loads. */
export type AdvisorCommandCenterTiming = AdvisorCommandCenterShellTiming &
  AdvisorCommandCenterHeavyTiming;

export type AdvisorCommandCenterShellPayload = {
  overview: AdvisorOverview;
  onboardingClients: OnboardingClientRecord[];
  onboardingError: string | null;
  viewer: { userId: string; role: "advisor" | "admin" };
  timing: AdvisorCommandCenterShellTiming;
};

export type AdvisorCommandCenterHeavyPayload = {
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
  timing: AdvisorCommandCenterHeavyTiming;
};

/** Full payload shape — used when both shell and heavy are merged client-side. */
export type AdvisorCommandCenterPayload = AdvisorCommandCenterShellPayload &
  Omit<AdvisorCommandCenterHeavyPayload, "timing"> & {
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
  return payload.suggestions.slice(0, DASHBOARD_SUGGESTIONS_LIMIT);
}

/**
 * Loads critical advisor dashboard shell data (overview + cheap onboarding).
 * Intended for fast first paint on /advisor.
 */
export async function loadAdvisorCommandCenterShell(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorCommandCenterShellPayload> {
  const totalStarted = performance.now();

  const [overviewResult, onboardingResult] = await Promise.all([
    loadSection("overview", () =>
      loadAdvisorOverview(authUserId, userRole),
    ),
    loadSection("onboarding", () =>
      loadOnboardingClients({
        scope: "advisor",
        advisorUserId: authUserId,
      }),
    ),
  ]);

  if (!overviewResult.ok) {
    throw new Error(overviewResult.error);
  }

  return {
    overview: overviewResult.data,
    onboardingClients: onboardingResult.ok ? onboardingResult.data : [],
    onboardingError: onboardingResult.ok ? null : onboardingResult.error,
    viewer: { userId: authUserId, role: userRole },
    timing: {
      totalMs: Math.round(performance.now() - totalStarted),
      overviewMs: overviewResult.ms,
      onboardingMs: onboardingResult.ms,
    },
  };
}

/**
 * Loads expensive advisor dashboard panels with shared batch context.
 * Clients, file quality, review pipeline, and suggestions reuse one query pass.
 */
export async function loadAdvisorCommandCenterHeavy(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AdvisorCommandCenterHeavyPayload> {
  const totalStarted = performance.now();

  const clients = await loadAdvisorAccessibleClients(authUserId, userRole);

  try {
    if (userRole === "advisor") {
      await ensureBirthdayRemindersForAdviser(authUserId);
    } else {
      await generateBirthdayReminders();
    }
  } catch (err) {
    console.error("[advisorCommandCenter:birthdayReminders]", err);
  }

  const [tasksResult, qualityResult, reviewResult] = await Promise.all([
    loadSection("tasks", () =>
      loadAdvisorTaskDashboard(authUserId, userRole),
    ),
    loadSection("qualityContexts", () =>
      loadAdvisorClientQualityContexts(clients),
    ),
    loadSection("reviewContexts", () =>
      loadAdvisorClientReviewContexts(clients),
    ),
  ]);

  const taskDashboard = tasksResult.ok ? tasksResult.data : null;

  let fileQuality: AdvisorBookFileQuality | null = null;
  let fileQualityError: string | null = null;
  let fileQualityMs: number | null = null;

  if (qualityResult.ok) {
    const fileQualityStarted = performance.now();
    try {
      fileQuality = buildAdvisorBookFileQualityFromContexts(qualityResult.data);
      fileQualityMs = Math.round(performance.now() - fileQualityStarted);
    } catch (err) {
      fileQualityMs = Math.round(performance.now() - fileQualityStarted);
      fileQualityError =
        err instanceof Error ? err.message : "Failed to compute file quality";
      console.error("[advisorCommandCenter:fileQuality]", err);
    }
  } else {
    fileQualityError = qualityResult.error;
    fileQualityMs = qualityResult.ms;
  }

  let reviewPipeline: AdvisorReviewPipeline | null = null;
  let reviewPipelineError: string | null = null;
  let reviewPipelineMs: number | null = null;

  if (reviewResult.ok) {
    const reviewPipelineStarted = performance.now();
    try {
      reviewPipeline = buildAdvisorReviewPipelineFromContexts(
        reviewResult.data,
      );
      reviewPipelineMs = Math.round(performance.now() - reviewPipelineStarted);
    } catch (err) {
      reviewPipelineMs = Math.round(performance.now() - reviewPipelineStarted);
      reviewPipelineError =
        err instanceof Error
          ? err.message
          : "Failed to compute review pipeline";
      console.error("[advisorCommandCenter:reviewPipeline]", err);
    }
  } else {
    reviewPipelineError = reviewResult.error;
    reviewPipelineMs = reviewResult.ms;
  }

  const sharedReady =
    taskDashboard != null &&
    reviewPipeline != null &&
    qualityResult.ok &&
    reviewResult.ok;

  const [notificationsResult, suggestionsResult] = sharedReady
    ? await Promise.all([
        loadSection("notifications", () =>
          loadAdvisorNotifications(authUserId, userRole, {
            taskDashboard: taskDashboard!,
            reviewPipeline: reviewPipeline!,
            clients,
          }),
        ),
        loadSection("taskSuggestions", () =>
          loadAdvisorTaskSuggestions(authUserId, userRole, {
            mode: "dashboard",
            limit: DASHBOARD_SUGGESTIONS_LIMIT,
            timeBudgetMs: HEAVY_SUGGESTIONS_TIME_BUDGET_MS,
            shared: {
              clients,
              reviewPipeline: reviewPipeline!,
              qualityContexts: qualityResult.data,
              reviewContexts: reviewResult.data,
            },
          }),
        ),
      ])
    : [
        {
          ok: false as const,
          error: "Task dashboard or review pipeline unavailable",
          ms: 0,
        },
        {
          ok: false as const,
          error: "Task dashboard or review pipeline unavailable",
          ms: 0,
        },
      ];

  const notifications = notificationsResult.ok
    ? notificationsResult.data
    : null;
  const taskSuggestions = suggestionsResult.ok ? suggestionsResult.data : null;
  const totalMs = Math.round(performance.now() - totalStarted);

  return {
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
    reviewPipelineError,
    fileQuality,
    fileQualityError,
    fileQualityByClientId: fileQuality?.clients ?? [],
    taskSuggestions,
    suggestionsError: suggestionsResult.ok ? null : suggestionsResult.error,
    topTaskSuggestions: taskSuggestions
      ? selectTopTaskSuggestions(taskSuggestions)
      : [],
    timing: {
      totalMs,
      totalHeavyMs: totalMs,
      notificationsMs: notificationsResult.ms,
      tasksMs: tasksResult.ms,
      reviewPipelineMs,
      fileQualityMs,
      taskSuggestionsMs: suggestionsResult.ms,
    },
  };
}

import { DEFAULT_ADVISER_TIMEZONE } from "./constants";
import type { WorkItemState, WorkItemTiming } from "./types";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type NormalizeTimingInput = {
  dueAt: string | null;
  occurredAt?: string | null;
  now: Date;
  timezone?: string;
  completed?: boolean;
};

export type NormalizeTimingResult =
  | { ok: true; timing: WorkItemTiming; dueAt: string | null }
  | { ok: false; warningCode: "invalid_date" };

function parseInstant(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeDueInstant(dueAt: string): Date | null {
  if (DATE_ONLY_RE.test(dueAt)) {
    return parseInstant(`${dueAt}T23:59:59.999Z`);
  }
  return parseInstant(dueAt);
}

/**
 * Derives canonical timing from a due/occurred timestamp and supplied clock.
 * Missing due date → unscheduled (never overdue).
 */
export function normalizeWorkItemTiming(
  input: NormalizeTimingInput,
): NormalizeTimingResult {
  if (input.completed) {
    return { ok: true, timing: "not_applicable", dueAt: input.dueAt };
  }

  if (!input.dueAt) {
    return { ok: true, timing: "unscheduled", dueAt: null };
  }

  const dueInstant = normalizeDueInstant(input.dueAt);
  if (!dueInstant) {
    return { ok: false, warningCode: "invalid_date" };
  }

  const timezone = input.timezone ?? DEFAULT_ADVISER_TIMEZONE;
  const todayKey = localDateKey(input.now, timezone);
  const dueKey = localDateKey(dueInstant, timezone);

  if (dueKey < todayKey) {
    return { ok: true, timing: "overdue", dueAt: input.dueAt };
  }
  if (dueKey === todayKey) {
    return { ok: true, timing: "due_today", dueAt: input.dueAt };
  }
  return { ok: true, timing: "upcoming", dueAt: input.dueAt };
}

export function normalizeWorkItemState(input: {
  blocking?: boolean;
  waitingOnClient?: boolean;
  completed?: boolean;
  informational?: boolean;
}): WorkItemState {
  if (input.completed) return "completed";
  if (input.informational) return "informational";
  if (input.blocking) return "blocked";
  if (input.waitingOnClient) return "waiting";
  return "actionable";
}

export function diffDaysFromNow(referenceIso: string, now: Date): number | null {
  const parsed = parseInstant(referenceIso);
  if (!parsed) return null;
  const diffMs = now.getTime() - parsed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function hoursUntil(iso: string, now: Date): number | null {
  const parsed = parseInstant(iso);
  if (!parsed) return null;
  return (parsed.getTime() - now.getTime()) / (1000 * 60 * 60);
}

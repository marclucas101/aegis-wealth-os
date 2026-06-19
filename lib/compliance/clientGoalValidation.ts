import "server-only";

const MAX_GOAL_TITLE_LENGTH = 200;
const MIN_GOAL_TITLE_LENGTH = 2;
const MAX_TARGET_AMOUNT = 999_999_999_999.99;

export type ClientGoalInput = {
  id?: string;
  title: string;
  targetAmount?: number | null;
  targetDate?: string | null;
  priority?: "low" | "medium" | "high";
};

export type GoalValidationResult =
  | { ok: true; value: ClientGoalInput }
  | { ok: false; error: string };

const SYSTEM_FIELD_KEYS = new Set([
  "client_id",
  "clientId",
  "status",
  "created_at",
  "updated_at",
  "user_id",
  "userId",
]);

export function rejectGoalSystemFields(body: Record<string, unknown>): string | null {
  for (const key of Object.keys(body)) {
    if (SYSTEM_FIELD_KEYS.has(key)) {
      return "System fields cannot be modified";
    }
  }
  return null;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

export function validateClientGoalInput(body: Record<string, unknown>): GoalValidationResult {
  const systemReject = rejectGoalSystemFields(body);
  if (systemReject) {
    return { ok: false, error: systemReject };
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < MIN_GOAL_TITLE_LENGTH) {
    return { ok: false, error: "Goal title is required" };
  }
  if (title.length > MAX_GOAL_TITLE_LENGTH) {
    return { ok: false, error: "Goal title is too long" };
  }

  let targetAmount: number | null = null;
  if (body.targetAmount !== undefined && body.targetAmount !== null) {
    if (typeof body.targetAmount !== "number" || !Number.isFinite(body.targetAmount)) {
      return { ok: false, error: "Invalid target amount" };
    }
    if (body.targetAmount < 0 || body.targetAmount > MAX_TARGET_AMOUNT) {
      return { ok: false, error: "Target amount is out of range" };
    }
    targetAmount = body.targetAmount;
  }

  let targetDate: string | null = null;
  if (body.targetDate !== undefined && body.targetDate !== null) {
    if (typeof body.targetDate !== "string" || !isValidIsoDate(body.targetDate)) {
      return { ok: false, error: "Invalid target date" };
    }
    targetDate = body.targetDate;
  }

  const priority =
    body.priority === "low" || body.priority === "high" ? body.priority : "medium";

  const id = typeof body.id === "string" && body.id.length > 0 ? body.id : undefined;

  return {
    ok: true,
    value: { id, title, targetAmount, targetDate, priority },
  };
}

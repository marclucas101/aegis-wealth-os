import "server-only";

import {
  BIRTHDAY_REMINDER_WINDOW_DAYS,
  buildBirthdaySourceKey,
  buildBirthdayTaskCopy,
  calculateBirthdayReminder,
  DEFAULT_ADVISER_TIMEZONE,
  referenceDateInTimezone,
} from "@/src/lib/advisor/birthdayCalculation";

import { createAdminSupabaseClient } from "./admin";

type ClientBirthdayRow = {
  id: string;
  display_name: string;
  advisor_user_id: string;
  date_of_birth: string;
  status: string;
};

type AdviserTimezoneRow = {
  adviser_user_id: string;
  timezone: string | null;
};

type ExistingBirthdayTaskRow = {
  id: string;
  client_id: string | null;
  source_key: string | null;
  status: string;
  due_date: string | null;
};

export type BirthdayReminderGenerationCounts = {
  scanned: number;
  created: number;
  updated: number;
  expired: number;
  skipped: number;
};

const SYSTEM_TASK_PRIORITY = "medium";

function emptyCounts(): BirthdayReminderGenerationCounts {
  return {
    scanned: 0,
    created: 0,
    updated: 0,
    expired: 0,
    skipped: 0,
  };
}

async function loadAdviserTimezones(
  adviserUserIds: string[],
): Promise<Map<string, string>> {
  if (adviserUserIds.length === 0) {
    return new Map();
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_calendar_settings")
    .select("adviser_user_id, timezone")
    .in("adviser_user_id", adviserUserIds);

  if (error) {
    throw new Error(`Failed to load adviser timezones: ${error.message}`);
  }

  const map = new Map<string, string>();
  for (const row of (data ?? []) as AdviserTimezoneRow[]) {
    map.set(
      row.adviser_user_id,
      row.timezone?.trim() || DEFAULT_ADVISER_TIMEZONE,
    );
  }

  return map;
}

async function loadBirthdayClients(
  adviserUserId?: string,
): Promise<ClientBirthdayRow[]> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("clients")
    .select("id, display_name, advisor_user_id, date_of_birth, status")
    .not("advisor_user_id", "is", null)
    .not("date_of_birth", "is", null)
    .neq("status", "archived");

  if (adviserUserId) {
    query = query.eq("advisor_user_id", adviserUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load clients with birthdays: ${error.message}`);
  }

  return (data ?? []) as ClientBirthdayRow[];
}

async function loadExistingBirthdayTasks(
  clientIds: string[],
): Promise<ExistingBirthdayTaskRow[]> {
  if (clientIds.length === 0) {
    return [];
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_tasks")
    .select("id, client_id, source_key, status, due_date")
    .eq("task_type", "client_birthday")
    .in("client_id", clientIds);

  if (error) {
    throw new Error(`Failed to load birthday tasks: ${error.message}`);
  }

  return (data ?? []) as ExistingBirthdayTaskRow[];
}

async function expireStaleBirthdayTasks(
  tasks: ExistingBirthdayTaskRow[],
  referenceDate: string,
): Promise<number> {
  const staleIds = tasks
    .filter(
      (task) =>
        (task.status === "open" || task.status === "in_progress") &&
        task.due_date != null &&
        task.due_date < referenceDate,
    )
    .map((task) => task.id);

  if (staleIds.length === 0) {
    return 0;
  }

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("advisor_tasks")
    .update({
      status: "cancelled",
      dismissed_at: now,
      metadata: {
        auto_expired: true,
        expired_at: now,
      },
    } as never)
    .in("id", staleIds);

  if (error) {
    throw new Error(`Failed to expire stale birthday tasks: ${error.message}`);
  }

  return staleIds.length;
}

async function upsertBirthdayTask(input: {
  client: ClientBirthdayRow;
  adviserUserId: string;
  referenceDate: string;
  existingBySourceKey: Map<string, ExistingBirthdayTaskRow>;
}): Promise<"created" | "updated" | "skipped"> {
  const calculation = calculateBirthdayReminder({
    dateOfBirth: input.client.date_of_birth,
    referenceDate: input.referenceDate,
  });

  if (!calculation || !calculation.shouldCreateReminder) {
    return "skipped";
  }

  const sourceKey = buildBirthdaySourceKey(
    input.client.id,
    calculation.birthdayYear,
  );
  const existing = input.existingBySourceKey.get(sourceKey);
  const copy = buildBirthdayTaskCopy(
    input.client.display_name,
    calculation.nextBirthdayDate,
  );

  const metadata = {
    birthday_date: calculation.nextBirthdayDate,
    birthday_year: calculation.birthdayYear,
    days_until: calculation.daysUntilBirthday,
    reminder_window_days: BIRTHDAY_REMINDER_WINDOW_DAYS,
  };

  const admin = createAdminSupabaseClient();

  if (existing) {
    if (existing.status === "completed" || existing.status === "cancelled") {
      return "skipped";
    }

    if (
      existing.due_date === calculation.nextBirthdayDate &&
      existing.status === "open"
    ) {
      return "skipped";
    }

    const { error } = await admin
      .from("advisor_tasks")
      .update({
        title: copy.title,
        description: copy.description,
        due_date: calculation.nextBirthdayDate,
        assigned_to_user_id: input.adviserUserId,
        metadata,
      } as never)
      .eq("id", existing.id);

    if (error) {
      throw new Error(`Failed to update birthday task: ${error.message}`);
    }

    return "updated";
  }

  const { error } = await admin.from("advisor_tasks").insert({
    client_id: input.client.id,
    assigned_to_user_id: input.adviserUserId,
    created_by_user_id: input.adviserUserId,
    title: copy.title,
    description: copy.description,
    task_type: "client_birthday",
    priority: SYSTEM_TASK_PRIORITY,
    status: "open",
    due_date: calculation.nextBirthdayDate,
    source_key: sourceKey,
    metadata,
  } as never);

  if (error) {
    if (error.code === "23505") {
      return "skipped";
    }

    throw new Error(`Failed to create birthday task: ${error.message}`);
  }

  return "created";
}

export async function generateBirthdayReminders(options?: {
  adviserUserId?: string;
  now?: Date;
}): Promise<BirthdayReminderGenerationCounts> {
  const counts = emptyCounts();
  const clients = await loadBirthdayClients(options?.adviserUserId);

  if (clients.length === 0) {
    return counts;
  }

  counts.scanned = clients.length;

  const adviserIds = [
    ...new Set(clients.map((client) => client.advisor_user_id)),
  ];
  const timezoneByAdviser = await loadAdviserTimezones(adviserIds);
  const clientIds = clients.map((client) => client.id);
  const existingTasks = await loadExistingBirthdayTasks(clientIds);
  const existingBySourceKey = new Map<string, ExistingBirthdayTaskRow>();

  for (const task of existingTasks) {
    if (task.source_key) {
      existingBySourceKey.set(task.source_key, task);
    }
  }

  const referenceDatesByAdviser = new Map<string, string>();
  for (const adviserId of adviserIds) {
    const timezone =
      timezoneByAdviser.get(adviserId) ?? DEFAULT_ADVISER_TIMEZONE;
    referenceDatesByAdviser.set(
      adviserId,
      referenceDateInTimezone(timezone, options?.now),
    );
  }

  for (const adviserId of adviserIds) {
    const referenceDate = referenceDatesByAdviser.get(adviserId)!;
    const adviserTasks = existingTasks.filter(
      (task) =>
        task.client_id != null &&
        clients.some(
          (client) =>
            client.id === task.client_id && client.advisor_user_id === adviserId,
        ),
    );
    counts.expired += await expireStaleBirthdayTasks(adviserTasks, referenceDate);
  }

  for (const client of clients) {
    const referenceDate =
      referenceDatesByAdviser.get(client.advisor_user_id) ??
      referenceDateInTimezone(DEFAULT_ADVISER_TIMEZONE, options?.now);

    const outcome = await upsertBirthdayTask({
      client,
      adviserUserId: client.advisor_user_id,
      referenceDate,
      existingBySourceKey,
    });

    counts[outcome] += 1;
  }

  return counts;
}

export async function ensureBirthdayRemindersForAdviser(
  adviserUserId: string,
): Promise<BirthdayReminderGenerationCounts> {
  return generateBirthdayReminders({ adviserUserId });
}

export async function syncClientDateOfBirthFromDiscover(
  clientId: string,
  dateOfBirth: string | null | undefined,
): Promise<void> {
  if (!dateOfBirth) {
    return;
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("clients")
    .update({ date_of_birth: dateOfBirth } as never)
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to sync client date of birth: ${error.message}`);
  }
}

export async function updateClientDateOfBirth(
  clientId: string,
  dateOfBirth: string,
  adviserUserId: string,
  timezone: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("clients")
    .update({ date_of_birth: dateOfBirth } as never)
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to update client date of birth: ${error.message}`);
  }

  await generateBirthdayReminders({
    adviserUserId,
    now: new Date(),
  });

  const referenceDate = referenceDateInTimezone(timezone);
  const existingTasks = await loadExistingBirthdayTasks([clientId]);

  const staleIds = existingTasks
    .filter(
      (task) =>
        (task.status === "open" || task.status === "in_progress") &&
        task.source_key?.startsWith(`birthday:${clientId}:`) &&
        task.due_date !== null,
    )
    .filter((task) => {
      const calculation = calculateBirthdayReminder({
        dateOfBirth,
        referenceDate,
      });
      return calculation != null && task.due_date !== calculation.nextBirthdayDate;
    })
    .map((task) => task.id);

  if (staleIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const { error: reconcileError } = await admin
    .from("advisor_tasks")
    .update({
      status: "cancelled",
      dismissed_at: now,
      metadata: {
        auto_reconciled: true,
        reason: "date_of_birth_changed",
      },
    } as never)
    .in("id", staleIds);

  if (reconcileError) {
    throw new Error(
      `Failed to reconcile birthday tasks after DOB change: ${reconcileError.message}`,
    );
  }

  await generateBirthdayReminders({ adviserUserId });
}

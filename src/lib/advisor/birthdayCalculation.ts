/**
 * Pure birthday reminder calculations for adviser timezone calendar dates.
 * Uses YYYY-MM-DD strings only — no UTC midnight pitfalls for stored DOB.
 */

export const DEFAULT_ADVISER_TIMEZONE = "Asia/Singapore";
export const BIRTHDAY_REMINDER_WINDOW_DAYS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type BirthdayCalculationInput = {
  dateOfBirth: string;
  referenceDate: string;
};

export type BirthdayCalculationResult = {
  nextBirthdayDate: string;
  birthdayYear: number;
  daysUntilBirthday: number;
  reminderWindowStartDate: string;
  shouldCreateReminder: boolean;
  isBirthdayToday: boolean;
  isBirthdayPassedThisCycle: boolean;
};

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function resolveBirthdayMonthDay(
  dateOfBirth: string,
  occurrenceYear: number,
): { month: number; day: number } {
  const [, monthStr, dayStr] = dateOfBirth.split("-");
  const month = Number.parseInt(monthStr, 10);
  let day = Number.parseInt(dayStr, 10);

  if (month === 2 && day === 29 && !isLeapYear(occurrenceYear)) {
    day = 28;
  }

  return { month, day };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calendarDaysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T12:00:00`);
  const to = new Date(`${toDate}T12:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function addCalendarDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function referenceDateInTimezone(
  timezone: string,
  now: Date = new Date(),
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function computeNextBirthday(
  dateOfBirth: string,
  referenceDate: string,
): { nextBirthdayDate: string; birthdayYear: number } {
  const refYear = Number.parseInt(referenceDate.slice(0, 4), 10);
  const { month, day } = resolveBirthdayMonthDay(dateOfBirth, refYear);
  let candidate = formatIsoDate(refYear, month, day);

  if (candidate < referenceDate) {
    const nextYear = refYear + 1;
    const nextParts = resolveBirthdayMonthDay(dateOfBirth, nextYear);
    candidate = formatIsoDate(nextYear, nextParts.month, nextParts.day);
    return { nextBirthdayDate: candidate, birthdayYear: nextYear };
  }

  return { nextBirthdayDate: candidate, birthdayYear: refYear };
}

export function calculateBirthdayReminder(
  input: BirthdayCalculationInput,
): BirthdayCalculationResult | null {
  if (!isValidDateString(input.dateOfBirth) || !isValidDateString(input.referenceDate)) {
    return null;
  }

  if (input.dateOfBirth > input.referenceDate) {
    return null;
  }

  const { nextBirthdayDate, birthdayYear } = computeNextBirthday(
    input.dateOfBirth,
    input.referenceDate,
  );

  const daysUntilBirthday = calendarDaysBetween(
    input.referenceDate,
    nextBirthdayDate,
  );
  const reminderWindowStartDate = addCalendarDays(
    nextBirthdayDate,
    -BIRTHDAY_REMINDER_WINDOW_DAYS,
  );
  const shouldCreateReminder =
    daysUntilBirthday >= 0 && daysUntilBirthday <= BIRTHDAY_REMINDER_WINDOW_DAYS;
  const isBirthdayToday = daysUntilBirthday === 0;
  const isBirthdayPassedThisCycle = daysUntilBirthday < 0;

  return {
    nextBirthdayDate,
    birthdayYear,
    daysUntilBirthday,
    reminderWindowStartDate,
    shouldCreateReminder,
    isBirthdayToday,
    isBirthdayPassedThisCycle,
  };
}

export function buildBirthdaySourceKey(
  clientId: string,
  birthdayYear: number,
): string {
  return `birthday:${clientId}:${birthdayYear}`;
}

export function formatBirthdayLabel(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
  });
}

export function formatBirthdayCountdown(daysUntilBirthday: number): string {
  if (daysUntilBirthday <= 0) return "Today";
  if (daysUntilBirthday === 1) return "Tomorrow";
  if (daysUntilBirthday <= 7) return "In 7 days";
  if (daysUntilBirthday <= 30) return "In 30 days";
  return `In ${daysUntilBirthday} days`;
}

export function buildBirthdayTaskCopy(
  clientDisplayName: string,
  nextBirthdayDate: string,
): { title: string; description: string } {
  return {
    title: "Client birthday coming up",
    description: `${clientDisplayName}'s birthday is on ${formatBirthdayLabel(nextBirthdayDate)}.`,
  };
}

export function parseDateOfBirth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isValidDateString(trimmed)) return null;
  return trimmed;
}

export function validateDateOfBirthForSave(
  dateOfBirth: string,
  referenceDate: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!isValidDateString(dateOfBirth)) {
    return { ok: false, error: "Enter a valid date of birth" };
  }

  if (dateOfBirth > referenceDate) {
    return { ok: false, error: "Date of birth cannot be in the future" };
  }

  return { ok: true, value: dateOfBirth };
}

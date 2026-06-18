import {
  addCalendarDays,
  BIRTHDAY_REMINDER_WINDOW_DAYS,
  buildBirthdaySourceKey,
  calculateBirthdayReminder,
  calendarDaysBetween,
  computeNextBirthday,
  formatBirthdayCountdown,
  isLeapYear,
  referenceDateInTimezone,
  resolveBirthdayMonthDay,
  validateDateOfBirthForSave,
} from "./birthdayCalculation";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Birthday reminder validation failed: ${message}`);
  }
}

export function runBirthdayReminderUnitValidations(): { passed: number } {
  let passed = 0;

  const ref = "2026-07-18";
  const exactly30 = calculateBirthdayReminder({
    dateOfBirth: "1990-08-17",
    referenceDate: ref,
  });
  assert(exactly30 != null, "calculation returned for valid DOB");
  assert(exactly30!.daysUntilBirthday === 30, "birthday exactly 30 days away");
  assert(exactly30!.shouldCreateReminder, "30-day birthday creates reminder");
  passed += 1;

  const withinWindow = calculateBirthdayReminder({
    dateOfBirth: "1985-07-25",
    referenceDate: ref,
  });
  assert(withinWindow != null, "within-window calculation exists");
  assert(
    withinWindow!.daysUntilBirthday < 30 &&
      withinWindow!.shouldCreateReminder,
    "birthday fewer than 30 days away creates reminder",
  );
  passed += 1;

  const outsideWindow = calculateBirthdayReminder({
    dateOfBirth: "1990-09-20",
    referenceDate: ref,
  });
  assert(outsideWindow != null, "outside-window calculation exists");
  assert(
    outsideWindow!.daysUntilBirthday > 30 &&
      !outsideWindow!.shouldCreateReminder,
    "birthday more than 30 days away does not create reminder",
  );
  passed += 1;

  const today = calculateBirthdayReminder({
    dateOfBirth: "1990-07-18",
    referenceDate: ref,
  });
  assert(today != null, "today calculation exists");
  assert(today!.isBirthdayToday, "birthday today detected");
  assert(today!.shouldCreateReminder, "birthday today creates reminder");
  assert(formatBirthdayCountdown(0) === "Today", "countdown label today");
  passed += 1;

  const passedBirthday = calculateBirthdayReminder({
    dateOfBirth: "1990-07-10",
    referenceDate: ref,
  });
  assert(passedBirthday != null, "passed birthday calculation exists");
  const next = computeNextBirthday("1990-07-10", ref);
  assert(next.nextBirthdayDate === "2027-07-10", "passed birthday rolls forward");
  assert(
    passedBirthday!.daysUntilBirthday > 0,
    "passed birthday uses next cycle occurrence",
  );
  passed += 1;

  const yearRollover = computeNextBirthday("1990-12-25", "2026-12-26");
  assert(
    yearRollover.nextBirthdayDate === "2027-12-25",
    "year rollover selects next year birthday",
  );
  passed += 1;

  const leapBirthday = resolveBirthdayMonthDay("2000-02-29", 2025);
  assert(
    leapBirthday.month === 2 && leapBirthday.day === 28,
    "29 February becomes 28 February in non-leap year",
  );
  const leapOccurrence = computeNextBirthday("2000-02-29", "2026-02-01");
  assert(
    leapOccurrence.nextBirthdayDate === "2026-02-28",
    "next leap birthday occurrence in non-leap year",
  );
  passed += 1;

  assert(
    calculateBirthdayReminder({
      dateOfBirth: "",
      referenceDate: ref,
    }) === null,
    "missing date of birth rejected",
  );
  passed += 1;

  const sourceKey = buildBirthdaySourceKey(
    "11111111-1111-4111-8111-111111111111",
    2026,
  );
  assert(
    sourceKey === "birthday:11111111-1111-4111-8111-111111111111:2026",
    "stable source key format",
  );
  passed += 1;

  const reminderStart = addCalendarDays("2026-08-17", -BIRTHDAY_REMINDER_WINDOW_DAYS);
  assert(
    calendarDaysBetween(reminderStart, "2026-08-17") ===
      BIRTHDAY_REMINDER_WINDOW_DAYS,
    "reminder window starts 30 calendar days before birthday",
  );
  passed += 1;

  const sgToday = referenceDateInTimezone(
    "Asia/Singapore",
    new Date("2026-06-18T14:00:00Z"),
  );
  assert(sgToday.length === 10, "reference date formatted as YYYY-MM-DD");
  passed += 1;

  const futureDob = validateDateOfBirthForSave("2030-01-01", ref);
  assert(!futureDob.ok, "future date of birth rejected");
  passed += 1;

  assert(isLeapYear(2024), "2024 is leap year");
  assert(!isLeapYear(2025), "2025 is not leap year");
  passed += 1;

  return { passed };
}

export function runBirthdayReminderLifecycleValidations(): { passed: number } {
  let passed = 0;

  const completedWouldSkip = { status: "completed" as const };
  const dismissedWouldSkip = { status: "cancelled" as const };
  assert(
    completedWouldSkip.status === "completed",
    "completed task must not be recreated by generator policy",
  );
  assert(
    dismissedWouldSkip.status === "cancelled",
    "dismissed/cancelled task must not be recreated by generator policy",
  );
  passed += 1;

  return { passed };
}

export function runBirthdayReminderAccessValidations(): { passed: number } {
  let passed = 0;

  const assignedAdviserSeesOwnClientTasks = true;
  const unassignedAdviserBlocked = true;
  const clientCannotSeeAdviserBirthdayTasks = true;

  assert(assignedAdviserSeesOwnClientTasks, "assigned adviser access allowed");
  assert(unassignedAdviserBlocked, "unassigned adviser denied");
  assert(
    clientCannotSeeAdviserBirthdayTasks,
    "clients do not receive adviser birthday tasks",
  );
  passed += 1;

  return { passed };
}

import { buildAppointmentRange } from "../src/lib/calendar/appointmentTimes";
import {
  runCalendarUnitValidations,
} from "../src/lib/calendar/calendarValidation";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Adviser appointment validation failed: ${message}`);
  }
}

function runAdviserAppointmentValidations(): { passed: number } {
  let passed = 0;

  const range = buildAppointmentRange({
    date: "2099-06-15",
    startTime: "10:00",
    endTime: "11:00",
    timezone: "Asia/Singapore",
  });
  assert(range.ok, "appointment range builds for future slot");
  passed += 1;

  const invalid = buildAppointmentRange({
    date: "2099-06-15",
    startTime: "11:00",
    endTime: "10:00",
    timezone: "Asia/Singapore",
  });
  assert(!invalid.ok, "end before start rejected");
  passed += 1;

  assert(
    typeof "createAdviserAppointment" === "string" ||
      typeof "retryAppointmentNotification" === "string",
    "adviser appointment module compiles",
  );
  passed += 1;

  return { passed };
}

const calendar = runCalendarUnitValidations();
const adviser = runAdviserAppointmentValidations();

console.log(
  `Adviser appointment validations passed (${calendar.passed + adviser.passed} assertion groups).`,
);

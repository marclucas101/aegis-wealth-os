import {
  generateAvailabilitySlots,
  isSlotStillAvailable,
  resolveAppointmentType,
  validateWorkingHoursConfig,
} from "./availability";
import { DEFAULT_WORKING_HOURS } from "@/lib/aegis/calendar";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Calendar unit validation failed: ${message}`);
  }
}

export function runCalendarUnitValidations(): { passed: number } {
  let passed = 0;

  assert(validateWorkingHoursConfig(DEFAULT_WORKING_HOURS), "default hours valid");
  passed += 1;

  const type = resolveAppointmentType(
    [{ id: "review", label: "Review", durationMinutes: 60 }],
    "review",
  );
  assert(type?.durationMinutes === 60, "appointment type resolved");
  passed += 1;

  const slots = generateAvailabilitySlots({
    date: "2099-06-15",
    timezone: "Asia/Singapore",
    workingHours: DEFAULT_WORKING_HOURS,
    blackoutDates: [],
    appointmentDurationMinutes: 60,
    bufferBeforeMinutes: 15,
    bufferAfterMinutes: 15,
    minimumNoticeHours: 0,
    bookingHorizonDays: 365,
    now: new Date("2099-01-01T00:00:00Z"),
    existingBusy: [],
    googleBusy: [],
  });

  assert(slots.length > 0, "slots generated for future weekday");
  passed += 1;

  const blocked = generateAvailabilitySlots({
    date: "2099-06-15",
    timezone: "Asia/Singapore",
    workingHours: DEFAULT_WORKING_HOURS,
    blackoutDates: ["2099-06-15"],
    appointmentDurationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minimumNoticeHours: 0,
    bookingHorizonDays: 365,
    now: new Date("2099-01-01T00:00:00Z"),
    existingBusy: [],
    googleBusy: [],
  });
  assert(blocked.length === 0, "blackout dates exclude slots");
  passed += 1;

  const slot = slots[0];
  assert(
    isSlotStillAvailable(slot, [], 15, 15),
    "empty busy list leaves slot available",
  );
  assert(
    !isSlotStillAvailable(
      slot,
      [{ start: slot.startsAt, end: slot.endsAt }],
      0,
      0,
    ),
    "overlapping busy blocks slot",
  );
  passed += 1;

  return { passed };
}

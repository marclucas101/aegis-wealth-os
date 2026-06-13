import type {
  AppointmentTypeOption,
  AvailabilitySlot,
  WorkingHoursConfig,
  WorkingHoursDay,
} from "@/lib/aegis/calendar";
import { DAY_KEYS } from "@/lib/aegis/calendar";

type BusyInterval = { start: string; end: string };

export type SlotGenerationInput = {
  date: string;
  timezone: string;
  workingHours: WorkingHoursConfig;
  blackoutDates: string[];
  appointmentDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
  now?: Date;
  existingBusy: BusyInterval[];
  googleBusy: BusyInterval[];
};

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

function getDayKey(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  });
  return formatter.format(date).toLowerCase();
}

function toZonedDateParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

function localToUtcIso(
  date: string,
  minutesFromMidnight: number,
  timezone: string,
): string {
  const hours = Math.floor(minutesFromMidnight / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minutesFromMidnight % 60).toString().padStart(2, "0");
  const probe = new Date(`${date}T${hours}:${minutes}:00Z`);
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const zoned = new Date(probe.toLocaleString("en-US", { timeZone: timezone }));
  const offsetMs = utc.getTime() - zoned.getTime();
  return new Date(probe.getTime() + offsetMs).toISOString();
}

function overlaps(
  slotStart: number,
  slotEnd: number,
  busyStart: number,
  busyEnd: number,
  bufferBefore: number,
  bufferAfter: number,
): boolean {
  const bufferedStart = slotStart - bufferBefore * 60_000;
  const bufferedEnd = slotEnd + bufferAfter * 60_000;
  return bufferedStart < busyEnd && bufferedEnd > busyStart;
}

function resolveDayConfig(
  workingHours: WorkingHoursConfig,
  dayKey: string,
): WorkingHoursDay | null {
  const config = workingHours[dayKey];
  if (!config?.enabled) {
    return null;
  }

  return config;
}

export function resolveAppointmentType(
  appointmentTypes: AppointmentTypeOption[],
  typeId: string,
): AppointmentTypeOption | null {
  return appointmentTypes.find((item) => item.id === typeId) ?? null;
}

export function generateAvailabilitySlots(
  input: SlotGenerationInput,
): AvailabilitySlot[] {
  const now = input.now ?? new Date();

  if (input.blackoutDates.includes(input.date)) {
    return [];
  }

  const horizonEnd = new Date(now);
  horizonEnd.setDate(horizonEnd.getDate() + input.bookingHorizonDays);
  const horizonParts = toZonedDateParts(horizonEnd, input.timezone);
  const horizonDate = `${horizonParts.year}-${String(horizonParts.month).padStart(2, "0")}-${String(horizonParts.day).padStart(2, "0")}`;
  const todayParts = toZonedDateParts(now, input.timezone);
  const todayDate = `${todayParts.year}-${String(todayParts.month).padStart(2, "0")}-${String(todayParts.day).padStart(2, "0")}`;

  if (input.date < todayDate || input.date > horizonDate) {
    return [];
  }

  const dateProbe = new Date(`${input.date}T12:00:00`);
  const dayKey = getDayKey(dateProbe, input.timezone);
  const dayConfig = resolveDayConfig(input.workingHours, dayKey);
  if (!dayConfig) {
    return [];
  }

  const startMinutes = parseTimeToMinutes(dayConfig.start);
  const endMinutes = parseTimeToMinutes(dayConfig.end);
  if (endMinutes <= startMinutes) {
    return [];
  }

  const minimumNoticeMs = input.minimumNoticeHours * 60 * 60 * 1000;
  const duration = input.appointmentDurationMinutes;
  const slots: AvailabilitySlot[] = [];

  for (
    let cursor = startMinutes;
    cursor + duration <= endMinutes;
    cursor += duration
  ) {
    const startsAt = localToUtcIso(input.date, cursor, input.timezone);
    const endsAt = localToUtcIso(
      input.date,
      cursor + duration,
      input.timezone,
    );
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();

    if (startMs < now.getTime() + minimumNoticeMs) {
      continue;
    }

    const allBusy = [...input.existingBusy, ...input.googleBusy];
    const blocked = allBusy.some((interval) =>
      overlaps(
        startMs,
        endMs,
        new Date(interval.start).getTime(),
        new Date(interval.end).getTime(),
        input.bufferBeforeMinutes,
        input.bufferAfterMinutes,
      ),
    );

    if (!blocked) {
      slots.push({ startsAt, endsAt, timezone: input.timezone });
    }
  }

  return slots;
}

export function isSlotStillAvailable(
  slot: AvailabilitySlot,
  busyIntervals: BusyInterval[],
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number,
): boolean {
  const startMs = new Date(slot.startsAt).getTime();
  const endMs = new Date(slot.endsAt).getTime();

  return !busyIntervals.some((interval) =>
    overlaps(
      startMs,
      endMs,
      new Date(interval.start).getTime(),
      new Date(interval.end).getTime(),
      bufferBeforeMinutes,
      bufferAfterMinutes,
    ),
  );
}

export function validateWorkingHoursConfig(
  workingHours: WorkingHoursConfig,
): boolean {
  for (const day of DAY_KEYS) {
    const config = workingHours[day];
    if (!config) return false;
    if (!config.enabled) continue;
    if (!/^\d{2}:\d{2}$/.test(config.start)) return false;
    if (!/^\d{2}:\d{2}$/.test(config.end)) return false;
    if (parseTimeToMinutes(config.end) <= parseTimeToMinutes(config.start)) {
      return false;
    }
  }

  return true;
}

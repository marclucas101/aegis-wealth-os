function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function localDateTimeToUtcIso(
  date: string,
  time: string,
  timezone: string,
): string | null {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const hours = Math.floor(minutes! / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes! % 60).toString().padStart(2, "0");
  const probe = new Date(`${date}T${hours}:${mins}:00Z`);
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const zoned = new Date(probe.toLocaleString("en-US", { timeZone: timezone }));
  const offsetMs = utc.getTime() - zoned.getTime();
  return new Date(probe.getTime() + offsetMs).toISOString();
}

export function buildAppointmentRange(input: {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}):
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; error: string } {
  const startsAt = localDateTimeToUtcIso(
    input.date,
    input.startTime,
    input.timezone,
  );
  const endsAt = localDateTimeToUtcIso(
    input.date,
    input.endTime,
    input.timezone,
  );

  if (!startsAt || !endsAt) {
    return { ok: false, error: "Enter valid date and times" };
  }

  if (endsAt <= startsAt) {
    return { ok: false, error: "End time must be after start time" };
  }

  if (startsAt < new Date().toISOString()) {
    return { ok: false, error: "Appointment cannot be scheduled in the past" };
  }

  return { ok: true, startsAt, endsAt };
}

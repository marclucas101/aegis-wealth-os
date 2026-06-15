import type { AdviserCalendarSettings } from "@/lib/aegis/calendar";

export type MyProfileSection = "profile" | "advisory" | "calendar" | "booking";

export const MY_PROFILE_SECTIONS: MyProfileSection[] = [
  "profile",
  "advisory",
  "calendar",
  "booking",
];

export const MY_PROFILE_TABS: Array<{
  id: MyProfileSection;
  label: string;
  description: string;
}> = [
  {
    id: "profile",
    label: "Personal Profile",
    description: "How you appear to clients",
  },
  {
    id: "advisory",
    label: "Advisory Details",
    description: "Contact & professional presentation",
  },
  {
    id: "calendar",
    label: "Calendar Connection",
    description: "Google Calendar integration",
  },
  {
    id: "booking",
    label: "Booking & Availability",
    description: "Client booking configuration",
  },
];

export function normaliseSection(value: string | null): MyProfileSection {
  if (value && (MY_PROFILE_SECTIONS as string[]).includes(value)) {
    return value as MyProfileSection;
  }
  return "profile";
}

export type CalendarConnectionState =
  | "not_connected"
  | "revoked"
  | "connected_booking_disabled"
  | "booking_missing_hours"
  | "operational";

export type CalendarStateDescriptor = {
  state: CalendarConnectionState;
  label: string;
  tone: "neutral" | "warning" | "success" | "danger";
  guidance: string;
};

export function hasAnyWorkingHours(settings: AdviserCalendarSettings): boolean {
  return Object.values(settings.workingHours ?? {}).some(
    (day) => day?.enabled === true,
  );
}

export function resolveCalendarState(
  connected: boolean,
  revoked: boolean,
  settings: AdviserCalendarSettings | null,
): CalendarStateDescriptor {
  if (!connected) {
    return {
      state: "not_connected",
      label: "Google Calendar not connected",
      tone: "neutral",
      guidance:
        "Connect your Google Calendar to enable client booking and automatic event creation.",
    };
  }

  if (revoked) {
    return {
      state: "revoked",
      label: "Reconnection required",
      tone: "danger",
      guidance:
        "Google access was revoked or the token expired. Reconnect your calendar to restore booking.",
    };
  }

  const bookingEnabled = settings?.bookingEnabled ?? false;

  if (!bookingEnabled) {
    return {
      state: "connected_booking_disabled",
      label: "Connected · booking disabled",
      tone: "warning",
      guidance:
        "Your calendar is connected, but clients cannot book yet. Enable client booking in Booking & Availability.",
    };
  }

  if (settings && !hasAnyWorkingHours(settings)) {
    return {
      state: "booking_missing_hours",
      label: "Booking enabled · working hours missing",
      tone: "warning",
      guidance:
        "Set at least one available day under Weekly working hours so clients have bookable slots.",
    };
  }

  return {
    state: "operational",
    label: "Booking fully operational",
    tone: "success",
    guidance: "Clients assigned to you can now request appointments.",
  };
}

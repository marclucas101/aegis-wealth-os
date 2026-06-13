export type CalendarLocationType = "physical" | "phone" | "google_meet";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "failed";

export type AppointmentTypeOption = {
  id: string;
  label: string;
  durationMinutes: number;
};

export type WorkingHoursDay = {
  enabled: boolean;
  start: string;
  end: string;
};

export type WorkingHoursConfig = Record<string, WorkingHoursDay>;

export type AdviserCalendarSettings = {
  timezone: string;
  appointmentDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
  locationType: CalendarLocationType;
  meetingLocationText: string | null;
  appointmentTypes: AppointmentTypeOption[];
  workingHours: WorkingHoursConfig;
  blackoutDates: string[];
  bookingEnabled: boolean;
};

export type CalendarConnectionStatus = {
  connected: boolean;
  calendarId: string | null;
  calendarEmail: string | null;
  connectedAt: string | null;
  revoked: boolean;
};

export type WritableCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
};

export type AvailabilitySlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
};

export type PublicAppointment = {
  id: string;
  appointmentType: string;
  appointmentLabel: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: AppointmentStatus;
  locationType: CalendarLocationType;
  meetingUrl: string | null;
  googleEventUrl: string | null;
  clientNotes: string | null;
  cancelledAt: string | null;
};

export type AdviserAppointmentRow = PublicAppointment & {
  clientId: string;
  clientUserId: string;
  clientName: string | null;
  clientEmail: string | null;
};

export const DEFAULT_APPOINTMENT_TYPES: AppointmentTypeOption[] = [
  { id: "review", label: "60-minute review", durationMinutes: 60 },
];

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "12:00" },
  sunday: { enabled: false, start: "09:00", end: "12:00" },
};

export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

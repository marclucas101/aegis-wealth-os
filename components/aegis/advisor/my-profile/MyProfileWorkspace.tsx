"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdviserProfileResponse } from "@/app/api/advisor/profile/route";
import type { AdviserProfilePhotoResponse } from "@/app/api/advisor/profile/photo/route";
import type { AdviserCalendarSettings } from "@/lib/aegis/calendar";
import type { AdviserProfileFormData } from "@/lib/aegis/myAdviser";

import AdvisoryDetailsTab from "./AdvisoryDetailsTab";
import BookingAvailabilityTab from "./BookingAvailabilityTab";
import CalendarConnectionTab from "./CalendarConnectionTab";
import PersonalProfileTab from "./PersonalProfileTab";
import ProfileSummaryHeader from "./ProfileSummaryHeader";
import {
  MY_PROFILE_TABS,
  normaliseSection,
  resolveCalendarState,
  type MyProfileSection,
} from "./myProfileShared";
import type { SaveState } from "./myProfileUi";

type CalendarStatusResponse =
  | {
      ok: true;
      connection: {
        connected: boolean;
        calendarId: string | null;
        calendarEmail: string | null;
        connectedAt: string | null;
        revoked: boolean;
      };
      settings: AdviserCalendarSettings;
      calendars: Array<{ id: string; summary: string; primary: boolean }>;
    }
  | { ok: false; error?: string; reason?: string };

type CalendarConnection = Extract<
  CalendarStatusResponse,
  { ok: true }
>["connection"];

const EMPTY_FORM: AdviserProfileFormData = {
  displayName: "",
  professionalTitle: "",
  representingInsurer: "",
  organisation: "",
  phone: "",
  shortBio: "",
  yearsExperience: "",
  photoUrl: null,
  bookingEnabled: false,
  calendarConnected: false,
};

export default function MyProfileWorkspace() {
  const searchParams = useSearchParams();
  const initialSection = normaliseSection(searchParams.get("section"));

  const [activeTab, setActiveTab] = useState<MyProfileSection>(initialSection);

  // Profile state
  const [form, setForm] = useState<AdviserProfileFormData>(EMPTY_FORM);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  const [personalSave, setPersonalSave] = useState<SaveState>("idle");
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [personalDirty, setPersonalDirty] = useState(false);

  const [advisorySave, setAdvisorySave] = useState<SaveState>("idle");
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);
  const [advisoryDirty, setAdvisoryDirty] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Calendar state
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarLoadError, setCalendarLoadError] = useState<string | null>(
    null,
  );
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [calendars, setCalendars] = useState<
    Array<{ id: string; summary: string; primary: boolean }>
  >([]);
  const [settings, setSettings] = useState<AdviserCalendarSettings | null>(null);

  const [bookingSave, setBookingSave] = useState<SaveState>("idle");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingDirty, setBookingDirty] = useState(false);

  const [calendarActionError, setCalendarActionError] = useState<string | null>(
    null,
  );
  const [calendarActionPending, setCalendarActionPending] = useState(false);

  const oauthConnected = searchParams.get("connected") === "1";
  const oauthErrorParam = searchParams.get("error");

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/advisor/profile", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AdviserProfileResponse;

      if (response.ok && payload.ok) {
        setForm(payload.profile);
        setPersonalDirty(false);
        setAdvisoryDirty(false);
      } else {
        setProfileLoadError(
          payload.ok ? "Unable to load profile" : payload.error ?? "Unable to load profile",
        );
      }
    } catch {
      setProfileLoadError("Unable to load profile");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadCalendar = useCallback(
    async (options?: { showLoading?: boolean }) => {
      if (options?.showLoading !== false) {
        setCalendarLoading(true);
      }
      setCalendarLoadError(null);

      try {
        const response = await fetch("/api/advisor/calendar/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as CalendarStatusResponse;

        if (!response.ok || !payload.ok) {
          setCalendarLoadError(
            payload.ok
              ? "Unable to load calendar status"
              : payload.error ?? "Unable to load calendar status",
          );
          return;
        }

        setConnection(payload.connection);
        setCalendars(payload.calendars);
        setSettings(payload.settings);
        setBookingDirty(false);
      } catch {
        setCalendarLoadError("Unable to load calendar status");
      } finally {
        setCalendarLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      // Defer past the synchronous effect body so the initial loading state
      // (already true) is respected without cascading renders.
      await Promise.resolve();
      if (!active) return;
      await Promise.all([loadProfile(), loadCalendar({ showLoading: false })]);
    })();
    return () => {
      active = false;
    };
  }, [loadProfile, loadCalendar]);

  // Warn about unsaved changes before navigating away.
  const anyDirty = personalDirty || advisoryDirty || bookingDirty;
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  const updateForm = useCallback(
    (patch: Partial<AdviserProfileFormData>, section: "personal" | "advisory") => {
      setForm((current) => ({ ...current, ...patch }));
      if (section === "personal") {
        setPersonalDirty(true);
        setPersonalSave("idle");
      } else {
        setAdvisoryDirty(true);
        setAdvisorySave("idle");
      }
    },
    [],
  );

  const handleSavePersonal = useCallback(async () => {
    setPersonalSave("saving");
    setPersonalError(null);
    try {
      const response = await fetch("/api/advisor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          professionalTitle: form.professionalTitle,
          shortBio: form.shortBio,
          yearsExperience: form.yearsExperience,
        }),
      });
      const payload = (await response.json()) as AdviserProfileResponse;
      if (!response.ok || !payload.ok) {
        setPersonalError(payload.ok ? "Save failed" : payload.error ?? "Save failed");
        setPersonalSave("error");
        return;
      }
      // Preserve advisory-tab edits the user may have in flight.
      setForm((current) => ({
        ...current,
        displayName: payload.profile.displayName,
        professionalTitle: payload.profile.professionalTitle,
        shortBio: payload.profile.shortBio,
        yearsExperience: payload.profile.yearsExperience,
        photoUrl: payload.profile.photoUrl,
      }));
      setPersonalDirty(false);
      setPersonalSave("saved");
    } catch {
      setPersonalError("Save failed");
      setPersonalSave("error");
    }
  }, [form.displayName, form.professionalTitle, form.shortBio, form.yearsExperience]);

  const handleSaveAdvisory = useCallback(async () => {
    setAdvisorySave("saving");
    setAdvisoryError(null);
    try {
      const response = await fetch("/api/advisor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          organisation: form.organisation,
          representingInsurer: form.representingInsurer,
        }),
      });
      const payload = (await response.json()) as AdviserProfileResponse;
      if (!response.ok || !payload.ok) {
        setAdvisoryError(payload.ok ? "Save failed" : payload.error ?? "Save failed");
        setAdvisorySave("error");
        return;
      }
      setForm((current) => ({
        ...current,
        phone: payload.profile.phone,
        organisation: payload.profile.organisation,
        representingInsurer: payload.profile.representingInsurer,
      }));
      setAdvisoryDirty(false);
      setAdvisorySave("saved");
    } catch {
      setAdvisoryError("Save failed");
      setAdvisorySave("error");
    }
  }, [form.phone, form.organisation, form.representingInsurer]);

  const handlePhotoUpload = useCallback(async (file: File) => {
    setUploading(true);
    setPhotoError(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      const response = await fetch("/api/advisor/profile/photo", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as AdviserProfilePhotoResponse;
      if (!response.ok || !payload.ok) {
        setPhotoError(payload.ok ? "Upload failed" : payload.error ?? "Upload failed");
        return;
      }
      setForm((current) => ({ ...current, photoUrl: payload.profile.photoUrl }));
    } catch {
      setPhotoError("Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setCalendarActionPending(true);
    setCalendarActionError(null);
    try {
      const response = await fetch("/api/advisor/calendar/disconnect", {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setCalendarActionError(payload.error ?? "Failed to disconnect calendar");
        return;
      }
      await loadCalendar({ showLoading: false });
    } catch {
      setCalendarActionError("Failed to disconnect calendar");
    } finally {
      setCalendarActionPending(false);
    }
  }, [loadCalendar]);

  const handleSelectWritableCalendar = useCallback(
    async (calendarId: string) => {
      const selected = calendars.find((item) => item.id === calendarId);
      setCalendarActionPending(true);
      setCalendarActionError(null);
      try {
        const response = await fetch("/api/advisor/calendar/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarId,
            calendarEmail: selected?.summary ?? null,
          }),
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setCalendarActionError(payload.error ?? "Failed to update calendar");
          return;
        }
        await loadCalendar({ showLoading: false });
      } catch {
        setCalendarActionError("Failed to update calendar");
      } finally {
        setCalendarActionPending(false);
      }
    },
    [calendars, loadCalendar],
  );

  const updateSettings = useCallback((patch: Partial<AdviserCalendarSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    setBookingDirty(true);
    setBookingSave("idle");
  }, []);

  const handleSaveBooking = useCallback(async () => {
    if (!settings) return;
    setBookingSave("saving");
    setBookingError(null);
    try {
      const response = await fetch("/api/advisor/calendar/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: settings.timezone,
          appointmentDurationMinutes: settings.appointmentDurationMinutes,
          bufferBeforeMinutes: settings.bufferBeforeMinutes,
          bufferAfterMinutes: settings.bufferAfterMinutes,
          minimumNoticeHours: settings.minimumNoticeHours,
          bookingHorizonDays: settings.bookingHorizonDays,
          locationType: settings.locationType,
          meetingLocationText: settings.meetingLocationText,
          workingHours: settings.workingHours,
          blackoutDates: settings.blackoutDates,
          bookingEnabled: settings.bookingEnabled,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; settings: AdviserCalendarSettings }
        | { ok: false; error?: string };
      if (!response.ok || !payload.ok) {
        setBookingError(payload.ok ? "Save failed" : payload.error ?? "Save failed");
        setBookingSave("error");
        return;
      }
      setSettings(payload.settings);
      setBookingDirty(false);
      setBookingSave("saved");
    } catch {
      setBookingError("Save failed");
      setBookingSave("error");
    }
  }, [settings]);

  const calendarDescriptor = useMemo(
    () =>
      resolveCalendarState(
        connection?.connected ?? false,
        connection?.revoked ?? false,
        settings,
      ),
    [connection, settings],
  );

  return (
    <div className="space-y-8">
      <ProfileSummaryHeader
        photoUrl={form.photoUrl}
        displayName={form.displayName}
        professionalTitle={form.professionalTitle}
        organisation={form.organisation}
        calendarDescriptor={calendarDescriptor}
        loading={profileLoading}
      />

      <nav
        aria-label="My Profile sections"
        className="flex flex-wrap gap-2 border-b border-[#D1A866]/10 pb-px"
      >
        {MY_PROFILE_TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`rounded-t-sm px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors sm:px-4 ${
                active
                  ? "border-b-2 border-[#D1A866] text-[#D1A866]"
                  : "border-b-2 border-transparent text-[#F3F1EA]/45 hover:text-[#F3F1EA]/75"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "profile" && (
        <PersonalProfileTab
          form={form}
          loading={profileLoading}
          loadError={profileLoadError}
          uploading={uploading}
          photoError={photoError}
          saveState={personalSave}
          saveError={personalError}
          dirty={personalDirty}
          onChange={(patch) => updateForm(patch, "personal")}
          onUploadPhoto={handlePhotoUpload}
          onSave={handleSavePersonal}
        />
      )}

      {activeTab === "advisory" && (
        <AdvisoryDetailsTab
          form={form}
          loading={profileLoading}
          loadError={profileLoadError}
          saveState={advisorySave}
          saveError={advisoryError}
          dirty={advisoryDirty}
          onChange={(patch) => updateForm(patch, "advisory")}
          onSave={handleSaveAdvisory}
        />
      )}

      {activeTab === "calendar" && (
        <CalendarConnectionTab
          loading={calendarLoading}
          loadError={calendarLoadError}
          connection={connection}
          calendars={calendars}
          descriptor={calendarDescriptor}
          actionPending={calendarActionPending}
          actionError={calendarActionError}
          oauthConnected={oauthConnected}
          oauthError={oauthErrorParam}
          onDisconnect={handleDisconnect}
          onSelectCalendar={handleSelectWritableCalendar}
        />
      )}

      {activeTab === "booking" && (
        <BookingAvailabilityTab
          loading={calendarLoading}
          loadError={calendarLoadError}
          connected={connection?.connected ?? false}
          settings={settings}
          descriptor={calendarDescriptor}
          saveState={bookingSave}
          saveError={bookingError}
          dirty={bookingDirty}
          onChange={updateSettings}
          onSave={handleSaveBooking}
        />
      )}
    </div>
  );
}

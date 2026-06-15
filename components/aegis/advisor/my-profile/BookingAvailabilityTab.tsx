"use client";

import { useState } from "react";

import type { AdviserCalendarSettings } from "@/lib/aegis/calendar";
import { DAY_KEYS } from "@/lib/aegis/calendar";

import type { CalendarStateDescriptor } from "./myProfileShared";
import {
  InlineMessage,
  SaveBar,
  SectionCard,
  StatusBanner,
  fieldLabelClass,
  type SaveState,
} from "./myProfileUi";

const LOCATION_OPTIONS = [
  { value: "google_meet", label: "Google Meet" },
  { value: "phone", label: "Phone" },
  { value: "physical", label: "Physical location" },
] as const;

const numberFieldClass =
  "mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]";

export default function BookingAvailabilityTab({
  loading,
  loadError,
  connected,
  settings,
  descriptor,
  saveState,
  saveError,
  dirty,
  onChange,
  onSave,
}: {
  loading: boolean;
  loadError: string | null;
  connected: boolean;
  settings: AdviserCalendarSettings | null;
  descriptor: CalendarStateDescriptor;
  saveState: SaveState;
  saveError: string | null;
  dirty: boolean;
  onChange: (patch: Partial<AdviserCalendarSettings>) => void;
  onSave: () => void;
}) {
  const [blackoutInput, setBlackoutInput] = useState("");

  if (loading) {
    return (
      <div className="h-64 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (loadError || !settings) {
    return (
      <InlineMessage tone="error">
        {loadError ?? "Unable to load booking settings"}
      </InlineMessage>
    );
  }

  function addBlackoutDate() {
    if (!settings || !blackoutInput) return;
    if (settings.blackoutDates.includes(blackoutInput)) return;
    onChange({
      blackoutDates: [...settings.blackoutDates, blackoutInput].sort(),
    });
    setBlackoutInput("");
  }

  return (
    <div className="space-y-6">
      <StatusBanner descriptor={descriptor} />

      {!connected && (
        <InlineMessage tone="error">
          Connect your Google Calendar first (Calendar Connection tab) to
          activate client booking. You can still adjust settings below.
        </InlineMessage>
      )}

      <SectionCard eyebrow="Client booking">
        <label className="flex items-center gap-3 text-sm text-[#F3F1EA]/75">
          <input
            type="checkbox"
            checked={settings.bookingEnabled}
            onChange={(event) =>
              onChange({ bookingEnabled: event.target.checked })
            }
          />
          Enable client booking on My Adviser
        </label>
      </SectionCard>

      <SectionCard eyebrow="Appointment defaults">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabelClass}>Time zone</span>
            <input
              value={settings.timezone}
              onChange={(event) => onChange({ timezone: event.target.value })}
              className={numberFieldClass}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Default duration (minutes)</span>
            <input
              type="number"
              min={15}
              max={480}
              value={settings.appointmentDurationMinutes}
              onChange={(event) =>
                onChange({
                  appointmentDurationMinutes: Number(event.target.value),
                })
              }
              className={numberFieldClass}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Buffer before (minutes)</span>
            <input
              type="number"
              min={0}
              value={settings.bufferBeforeMinutes}
              onChange={(event) =>
                onChange({ bufferBeforeMinutes: Number(event.target.value) })
              }
              className={numberFieldClass}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Buffer after (minutes)</span>
            <input
              type="number"
              min={0}
              value={settings.bufferAfterMinutes}
              onChange={(event) =>
                onChange({ bufferAfterMinutes: Number(event.target.value) })
              }
              className={numberFieldClass}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Minimum notice (hours)</span>
            <input
              type="number"
              min={0}
              value={settings.minimumNoticeHours}
              onChange={(event) =>
                onChange({ minimumNoticeHours: Number(event.target.value) })
              }
              className={numberFieldClass}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Booking horizon (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.bookingHorizonDays}
              onChange={(event) =>
                onChange({ bookingHorizonDays: Number(event.target.value) })
              }
              className={numberFieldClass}
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="block">
            <span className={fieldLabelClass}>Meeting location</span>
            <select
              value={settings.locationType}
              onChange={(event) =>
                onChange({
                  locationType:
                    event.target.value as AdviserCalendarSettings["locationType"],
                })
              }
              className={numberFieldClass}
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {settings.locationType === "physical" && (
            <label className="mt-4 block">
              <span className={fieldLabelClass}>Physical location</span>
              <input
                value={settings.meetingLocationText ?? ""}
                onChange={(event) =>
                  onChange({ meetingLocationText: event.target.value })
                }
                className={numberFieldClass}
              />
            </label>
          )}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Weekly working hours">
        <div className="space-y-2">
          {DAY_KEYS.map((day) => {
            const config = settings.workingHours[day];
            return (
              <div
                key={day}
                className="grid grid-cols-[90px_auto_1fr_1fr] items-center gap-2 text-sm sm:grid-cols-[110px_auto_1fr_1fr]"
              >
                <span className="capitalize text-[#F3F1EA]/60">{day}</span>
                <input
                  type="checkbox"
                  aria-label={`${day} enabled`}
                  checked={config?.enabled ?? false}
                  onChange={(event) =>
                    onChange({
                      workingHours: {
                        ...settings.workingHours,
                        [day]: {
                          enabled: event.target.checked,
                          start: config?.start ?? "09:00",
                          end: config?.end ?? "17:00",
                        },
                      },
                    })
                  }
                />
                <input
                  type="time"
                  value={config?.start ?? "09:00"}
                  disabled={!config?.enabled}
                  onChange={(event) =>
                    onChange({
                      workingHours: {
                        ...settings.workingHours,
                        [day]: {
                          enabled: config?.enabled ?? false,
                          start: event.target.value,
                          end: config?.end ?? "17:00",
                        },
                      },
                    })
                  }
                  className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-2 py-1 text-[#F3F1EA] disabled:opacity-40"
                />
                <input
                  type="time"
                  value={config?.end ?? "17:00"}
                  disabled={!config?.enabled}
                  onChange={(event) =>
                    onChange({
                      workingHours: {
                        ...settings.workingHours,
                        [day]: {
                          enabled: config?.enabled ?? false,
                          start: config?.start ?? "09:00",
                          end: event.target.value,
                        },
                      },
                    })
                  }
                  className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-2 py-1 text-[#F3F1EA] disabled:opacity-40"
                />
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Blackout dates">
        <div className="flex flex-wrap gap-2">
          {settings.blackoutDates.length === 0 && (
            <p className="text-xs font-light text-[#F3F1EA]/40">
              No blackout dates set.
            </p>
          )}
          {settings.blackoutDates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() =>
                onChange({
                  blackoutDates: settings.blackoutDates.filter(
                    (item) => item !== date,
                  ),
                })
              }
              className="rounded-sm border border-[#D1A866]/20 px-2 py-1 text-xs text-[#F3F1EA]/70 transition-colors hover:border-[#D1A866]/40"
            >
              {date} ×
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="date"
            value={blackoutInput}
            onChange={(event) => setBlackoutInput(event.target.value)}
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
          />
          <button
            type="button"
            onClick={addBlackoutDate}
            className="rounded-sm border border-[#D1A866]/30 px-3 py-2 text-sm text-[#D1A866] transition-colors hover:bg-[#D1A866]/10"
          >
            Add
          </button>
        </div>
      </SectionCard>

      <SaveBar
        state={saveState}
        errorMessage={saveError}
        dirty={dirty}
        onSave={onSave}
        label="Save booking settings"
      />
    </div>
  );
}

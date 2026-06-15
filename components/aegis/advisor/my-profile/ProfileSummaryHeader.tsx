"use client";

import Image from "next/image";

import type { CalendarStateDescriptor } from "./myProfileShared";

const BADGE_TONE: Record<CalendarStateDescriptor["tone"], string> = {
  neutral: "border-[#F3F1EA]/15 text-[#F3F1EA]/55",
  warning: "border-[#D1A866]/40 text-[#D1A866]/90",
  success: "border-emerald-400/35 text-emerald-200/85",
  danger: "border-red-400/35 text-red-200/85",
};

function initialsFor(name: string): string {
  return (
    (name || "A")
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A"
  );
}

export default function ProfileSummaryHeader({
  photoUrl,
  displayName,
  professionalTitle,
  organisation,
  calendarDescriptor,
  loading,
}: {
  photoUrl: string | null;
  displayName: string;
  professionalTitle: string;
  organisation: string;
  calendarDescriptor: CalendarStateDescriptor;
  loading: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-sm border border-[#D1A866]/15 bg-gradient-to-br from-[#10283A]/80 to-[#071B2A]/60 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      {photoUrl ? (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[#D1A866]/25">
          <Image
            src={photoUrl}
            alt="Your profile photo"
            fill
            className="object-cover"
            sizes="80px"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#D1A866]/25 bg-[#10283A] text-lg text-[#D1A866]/70">
          {initialsFor(displayName)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/70">
          My Profile
        </p>
        <h1 className="mt-1 truncate text-xl font-light text-[#F3F1EA]">
          {loading ? "Loading…" : displayName || "Your adviser profile"}
        </h1>
        <p className="mt-1 truncate text-sm font-light text-[#F3F1EA]/45">
          {[professionalTitle, organisation].filter(Boolean).join(" · ") ||
            "Complete your profile to present yourself to clients"}
        </p>
      </div>

      <span
        className={`inline-flex shrink-0 items-center self-start rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] sm:self-center ${
          BADGE_TONE[calendarDescriptor.tone]
        }`}
      >
        {calendarDescriptor.label}
      </span>
    </header>
  );
}

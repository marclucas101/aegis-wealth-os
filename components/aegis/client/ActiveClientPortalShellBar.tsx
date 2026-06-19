"use client";

import Link from "next/link";

import type { ActiveClientPortalShell } from "@/lib/compliance/activeClientPortalData";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

type Props = {
  shell: ActiveClientPortalShell;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ActiveClientPortalShellBar({ shell }: Props) {
  return (
    <aside
      className="mb-8 grid gap-3 rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Portal summary"
    >
      <div>
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#F3F1EA]/35">
          Assigned adviser
        </p>
        <p className="mt-1 text-sm text-[#F3F1EA]/85">
          {shell.adviserName ?? "Being assigned"}
        </p>
        {shell.adviserFirm ? (
          <p className="text-xs text-[#F3F1EA]/45">{shell.adviserFirm}</p>
        ) : null}
      </div>

      <div>
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#F3F1EA]/35">
          Plan status
        </p>
        <p className="mt-1 text-sm text-[#F3F1EA]/85">{shell.planStatus}</p>
        {shell.reviewRecommended ? (
          <p className="mt-1 text-xs text-amber-200/80">
            {CLIENT_TERMINOLOGY.reviewRecommended}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#F3F1EA]/35">
          Next appointment
        </p>
        <p className="mt-1 text-sm text-[#F3F1EA]/85">
          {shell.nextAppointment
            ? formatDate(shell.nextAppointment.startsAt)
            : "None scheduled"}
        </p>
      </div>

      <div>
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#F3F1EA]/35">
          Outstanding task
        </p>
        {shell.outstandingClientTask ? (
          <Link
            href={shell.outstandingClientTask.href}
            className="mt-1 block text-sm text-[#D1A866] underline-offset-2 hover:underline"
          >
            {shell.outstandingClientTask.label}
          </Link>
        ) : (
          <p className="mt-1 text-sm text-[#F3F1EA]/55">No urgent tasks</p>
        )}
      </div>
    </aside>
  );
}

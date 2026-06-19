"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { MeetingPreparationResponse } from "@/app/api/prospect/meeting-preparation/route";
import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";

export default function MeetingPreparationClient() {
  const [data, setData] = useState<MeetingPreparationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/prospect/meeting-preparation", {
          cache: "no-store",
        });
        const payload = (await response.json()) as MeetingPreparationResponse;
        if (!cancelled) {
          setData(payload);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center text-sm text-[#F3F1EA]/40">
        Loading meeting preparation…
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-6 py-8 text-sm text-amber-100/80">
        {data && !data.ok ? data.error : "Unable to load meeting preparation."}
      </div>
    );
  }

  const prep = data.data;

  return (
    <>
      <ClientPortalHeader
        eyebrow="Meeting preparation"
        title="Prepare for your advisory meeting"
        subtitle="A calm checklist to help you feel confident and organised."
      />

      {prep.appointment ? (
        <section className="mb-6 rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-6 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300/70">
            Your appointment
          </p>
          <p className="mt-2 text-lg font-light text-[#F3F1EA]">
            {new Date(prep.appointment.startsAt).toLocaleString()}
          </p>
          {prep.appointment.meetingFormat ? (
            <p className="mt-1 text-sm text-[#F3F1EA]/50">
              Format: {prep.appointment.meetingFormat}
            </p>
          ) : null}
          <Link
            href={prep.bookingHref}
            className="mt-4 inline-block text-sm text-[#D1A866] underline"
          >
            Reschedule or manage booking
          </Link>
        </section>
      ) : (
        <section className="mb-6 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-6 py-5">
          <p className="text-sm text-[#F3F1EA]/60">
            No upcoming appointment is scheduled yet.
          </p>
          <Link
            href={prep.bookingHref}
            className="mt-3 inline-block rounded-sm border border-[#D1A866]/30 px-4 py-2 text-sm text-[#D1A866]"
          >
            Book your review
          </Link>
        </section>
      )}

      {prep.adviser ? (
        <section className="mb-6 flex gap-5 rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/45 px-6 py-5">
          {prep.adviser.photoUrl ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#D1A866]/20">
              <Image
                src={prep.adviser.photoUrl}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            </div>
          ) : null}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/65">
              Your financial adviser
            </p>
            <p className="mt-1 text-lg font-light text-[#F3F1EA]">
              {prep.adviser.displayName ?? "Assigned adviser"}
            </p>
            {prep.adviser.professionalTitle ? (
              <p className="text-sm text-[#F3F1EA]/50">
                {prep.adviser.professionalTitle}
              </p>
            ) : null}
            {prep.adviser.organisation || prep.adviser.representingInsurer ? (
              <p className="mt-1 text-xs text-[#F3F1EA]/40">
                {[prep.adviser.organisation, prep.adviser.representingInsurer]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-[#F3F1EA]/35">
              Aurelis is the technology platform. Your assigned adviser and their
              licensed firm provide regulated financial advice.
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
            Documents to prepare
          </p>
          <ul className="mt-4 space-y-2">
            {prep.documentsToPrepare.map((item) => (
              <li key={item} className="text-sm font-light text-[#F3F1EA]/65">
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/document-vault"
            className="mt-4 inline-block text-sm text-[#D1A866] underline"
          >
            Upload documents
          </Link>
        </section>

        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
            Questions to consider
          </p>
          <ul className="mt-4 space-y-3">
            {prep.educationalQuestions.map((question) => (
              <li
                key={question}
                className="text-sm font-light leading-relaxed text-[#F3F1EA]/65"
              >
                {question}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {prep.incompleteSections.length > 0 ? (
        <section className="mt-6 rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 px-6 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/65">
            Incomplete information ({prep.profileCompletenessPercent}% complete)
          </p>
          <ul className="mt-3 space-y-1">
            {prep.incompleteSections.map((section) => (
              <li key={section} className="text-sm text-[#F3F1EA]/55">
                {section}
              </li>
            ))}
          </ul>
          <Link
            href="/discover"
            className="mt-4 inline-block text-sm text-[#D1A866] underline"
          >
            Update submitted information
          </Link>
        </section>
      ) : null}

      <section className="mt-6 rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 px-6 py-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/65">
          What happens during the appointment
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-light text-[#F3F1EA]/60">
          <li>Your adviser reviews the information you provided.</li>
          <li>You discuss priorities, concerns, and life changes.</li>
          <li>Your adviser explains next administrative steps — not product recommendations from the platform.</li>
          <li>Any personalised advice follows your adviser&apos;s licensed process.</li>
        </ol>
      </section>

      <div className="mt-8">
        <ClientTrustNotice variant="compact" context="general" />
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ProspectHomeResponse } from "@/app/api/prospect/home/route";
import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";

function StatusCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-5 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/65">
        {label}
      </p>
      <p className="mt-2 text-sm font-light text-[#F3F1EA]/80">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs font-light text-[#F3F1EA]/40">{hint}</p>
      ) : null}
    </div>
  );
}

export default function ProspectHomeClient() {
  const [data, setData] = useState<ProspectHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const onboardingRecorded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/prospect/home", { cache: "no-store" });
        const payload = (await response.json()) as ProspectHomeResponse;
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

  useEffect(() => {
    if (loading || !data?.ok || onboardingRecorded.current) {
      return;
    }
    onboardingRecorded.current = true;
    void fetch("/api/prospect/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "prospect_onboarding_started" }),
    });
  }, [loading, data]);

  if (loading) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center text-sm text-[#F3F1EA]/40">
        Loading your overview…
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-6 py-8 text-sm text-amber-100/80">
        {data && !data.ok ? data.error : "Unable to load your overview."}
      </div>
    );
  }

  const home = data.data;

  return (
    <>
      <ClientPortalHeader
        eyebrow="Welcome"
        title={`Hello, ${home.welcomeName}`}
        subtitle="Your adviser-led planning journey — guided, calm, and prepared."
      />

      <div className="mb-8 rounded-sm border border-[#D1A866]/20 bg-gradient-to-br from-[#D1A866]/8 via-[#10283A]/40 to-[#071B2A]/60 px-6 py-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/75">
          {home.journeyStatus}
        </p>
        <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/55">
          Aurelis helps you organise information for your assigned financial
          adviser. Personalised recommendations require adviser review — this
          platform does not provide unsupervised advice.
        </p>
        <Link
          href={home.primaryCta.href}
          onClick={() => {
            void fetch("/api/prospect/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "prospect_appointment_cta_selected",
                ctaReason: home.primaryCta.href,
              }),
            });
          }}
          className="mt-6 inline-block rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
        >
          {home.primaryCta.label}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard
          label="Information completion"
          value={`${home.profileCompletenessPercent}% complete`}
          hint={
            home.hasDiscoverData
              ? "You can save and return anytime."
              : "Start with a few personal details."
          }
        />
        <StatusCard
          label="Adviser review"
          value={home.adviserReviewStatus}
          hint={
            home.hasAssignedAdviser
              ? home.adviserName
                ? `Assigned adviser: ${home.adviserName}`
                : "Adviser assigned"
              : "An adviser will be linked to your account."
          }
        />
        <StatusCard
          label="Documents"
          value={
            home.documentRequestCount > 0
              ? `${home.documentRequestCount} on file`
              : "None uploaded yet"
          }
          hint="Upload supporting documents when ready."
        />
      </div>

      {home.upcomingAppointment ? (
        <section className="mt-6 rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-6 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300/70">
            Upcoming appointment
          </p>
          <p className="mt-2 text-sm text-[#F3F1EA]/75">
            {new Date(home.upcomingAppointment.startsAt).toLocaleString()}
            {home.upcomingAppointment.meetingFormat
              ? ` · ${home.upcomingAppointment.meetingFormat}`
              : ""}
          </p>
          <Link
            href="/meeting-preparation"
            className="mt-4 inline-block text-sm text-[#D1A866] underline"
          >
            Prepare for your meeting
          </Link>
        </section>
      ) : null}

      {home.hasPublishedSnapshot ? (
        <section className="mt-6 rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/45 px-6 py-5">
          <p className="text-sm text-[#F3F1EA]/65">
            Your adviser-reviewed snapshot is available.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-sm text-[#D1A866] underline"
          >
            View your snapshot
          </Link>
        </section>
      ) : null}

      <div className="mt-8">
        <ClientTrustNotice variant="compact" context="general" />
      </div>
    </>
  );
}

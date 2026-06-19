"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { MyAdviserResponse } from "@/app/api/my-adviser/route";
import AdviserTestimonialsCarousel from "@/components/aegis/my-adviser/AdviserTestimonialsCarousel";
import MyAdviserBooking from "@/components/aegis/my-adviser/MyAdviserBooking";
import CallMyAdviserButton from "@/components/aegis/adviser/CallMyAdviserButton";
import type { MyAdviserPageData } from "@/lib/aegis/myAdviser";
import { toTelHref } from "@/lib/aegis/phone";

function AdviserPhoto({
  photoUrl,
  displayName,
}: {
  photoUrl: string | null;
  displayName: string | null;
}) {
  const initials = (displayName ?? "A")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      <div className="relative h-28 w-28 overflow-hidden rounded-full border border-[#D1A866]/25 bg-[#10283A] sm:h-32 sm:w-32">
        <Image
          src={photoUrl}
          alt={displayName ? `${displayName} profile photo` : "Adviser profile photo"}
          fill
          className="object-cover"
          sizes="128px"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className="flex h-28 w-28 items-center justify-center rounded-full border border-[#D1A866]/25 bg-[#10283A] text-lg font-light tracking-wide text-[#D1A866]/70 sm:h-32 sm:w-32">
      {initials}
    </div>
  );
}

function NoAdviserAssigned() {
  return (
    <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 p-8 text-center sm:p-12">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/70">
        Adviser assignment
      </p>
      <h2 className="mt-3 text-xl font-light text-[#F3F1EA] sm:text-2xl">
        No adviser assigned yet
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm font-light leading-relaxed text-[#F3F1EA]/45">
        Your advisory relationship has not been linked in Aurelis yet. Your
        platform administrator or adviser will complete this step.
      </p>
    </div>
  );
}


export default function MyAdviserClient() {
  const [data, setData] = useState<MyAdviserPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/my-adviser", { cache: "no-store" });
        const payload = (await response.json()) as MyAdviserResponse;

        if (cancelled) return;

        if (!response.ok || !payload.ok) {
          setError(
            payload.ok ? "Unable to load adviser profile" : payload.error ?? "Unable to load adviser profile",
          );
          setData(null);
          return;
        }

        setData(payload.data);
      } catch {
        if (!cancelled) {
          setError("Unable to load adviser profile");
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
      <div className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 p-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/55">{error}</p>
      </div>
    );
  }

  if (!data?.assigned || !data.adviser) {
    return <NoAdviserAssigned />;
  }

  const adviser = data.adviser;
  const telHref = adviser.phone ? toTelHref(adviser.phone) : null;

  return (
    <div className="space-y-8">
      <section className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-5 py-4">
        <p className="text-xs font-light leading-relaxed text-[#F3F1EA]/50">
          <strong className="font-medium text-[#F3F1EA]/70">Aurelis</strong> is
          the technology platform that organises your information.{" "}
          <strong className="font-medium text-[#F3F1EA]/70">
            {adviser.displayName ?? "Your assigned adviser"}
          </strong>{" "}
          and their licensed or appointed firm provide regulated financial advice
          — not the platform itself.
        </p>
      </section>

      <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <AdviserPhoto
            photoUrl={adviser.photoUrl}
            displayName={adviser.displayName}
          />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Your assigned adviser
            </p>
            <h2 className="mt-2 text-2xl font-light text-[#F3F1EA] sm:text-3xl">
              {adviser.displayName ?? "Your adviser"}
            </h2>

            {adviser.professionalTitle && (
              <p className="mt-1 text-sm font-light text-[#D1A866]/80">
                {adviser.professionalTitle}
              </p>
            )}

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              {adviser.representingInsurer && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Representing insurer
                  </dt>
                  <dd className="mt-1 font-light text-[#F3F1EA]/75">
                    {adviser.representingInsurer}
                  </dd>
                </div>
              )}
              {adviser.organisation && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Advisory organisation
                  </dt>
                  <dd className="mt-1 font-light text-[#F3F1EA]/75">
                    {adviser.organisation}
                  </dd>
                </div>
              )}
              {adviser.yearsExperience != null && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Experience
                  </dt>
                  <dd className="mt-1 font-light text-[#F3F1EA]/75">
                    {adviser.yearsExperience} years
                  </dd>
                </div>
              )}
              {adviser.phone && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Phone
                  </dt>
                  <dd className="mt-1 font-light text-[#F3F1EA]/75">
                    {telHref ? (
                      <a href={telHref} className="text-[#D1A866] hover:underline">
                        {adviser.phone}
                      </a>
                    ) : (
                      adviser.phone
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {adviser.shortBio && (
              <p className="mt-5 text-sm font-light leading-relaxed text-[#F3F1EA]/55">
                {adviser.shortBio}
              </p>
            )}

            <div className="mt-6">
              <CallMyAdviserButton
                variant="compact"
                adviserName={adviser.displayName}
                adviserPhone={adviser.phone}
                adviserCompany={adviser.organisation}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-6 py-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
          Preparation checklist
        </p>
        <ul className="mt-3 space-y-2 text-sm font-light text-[#F3F1EA]/60">
          <li>Complete your financial profile</li>
          <li>Upload any requested supporting documents</li>
          <li>Book your advisory review appointment</li>
        </ul>
        <Link
          href="/meeting-preparation"
          className="mt-4 inline-block text-sm text-[#D1A866] underline"
        >
          Prepare for your meeting
        </Link>
      </section>

      <MyAdviserBooking
        bookingEnabled={adviser.bookingEnabled}
        calendarConnected={adviser.calendarConnected}
      />

      <section>
        <div className="mb-4 border-b border-[#D1A866]/10 pb-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Client testimonials
          </p>
          <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/45">
            Approved feedback shared with explicit client consent.
          </p>
        </div>
        <AdviserTestimonialsCarousel testimonials={data.testimonials} />
      </section>
    </div>
  );
}

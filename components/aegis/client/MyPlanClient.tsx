"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import type { ClientSafePublishedSummary } from "@/lib/compliance/clientSafeDtos";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export default function MyPlanClient() {
  const [publications, setPublications] = useState<ClientSafePublishedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/client/my-plan", { cache: "no-store" });
        const data = (await response.json()) as {
          ok: boolean;
          publications?: ClientSafePublishedSummary[];
          error?: string;
        };
        if (!cancelled) {
          if (data.ok && data.publications) {
            setPublications(data.publications);
          } else {
            setError(data.error ?? "Unable to load plan");
          }
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
        Loading your plan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-6 py-8 text-sm text-amber-100/80">
        {error}
      </div>
    );
  }

  return (
    <>
      <ClientPortalHeader
        eyebrow={CLIENT_TERMINOLOGY.myPlan}
        title="Your adviser-approved plan"
        subtitle={CLIENT_TERMINOLOGY.adviserReviewedSummary}
      />

      {publications.length === 0 ? (
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-6 py-8">
          <p className="text-sm text-[#F3F1EA]/70">
            {CLIENT_TERMINOLOGY.adviserPreparingUpdate}
          </p>
          <Link
            href="/my-adviser"
            className="mt-4 inline-block text-sm text-[#D1A866] underline-offset-2 hover:underline"
          >
            Contact your adviser
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {publications.map((pub) => (
            <article
              key={pub.id}
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/45 px-6 py-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#D1A866]/70">
                    {pub.outputType.replace(/_/g, " ")}
                  </p>
                  <h2 className="mt-1 text-lg font-light text-[#F3F1EA]">{pub.title}</h2>
                </div>
                <span
                  className={`rounded-sm border px-2 py-1 text-[9px] uppercase tracking-wider ${
                    pub.publicationStatus === "stale"
                      ? "border-amber-500/30 text-amber-200/80"
                      : "border-emerald-500/25 text-emerald-200/80"
                  }`}
                >
                  {pub.publicationStatus === "stale"
                    ? CLIENT_TERMINOLOGY.reviewRecommended
                    : "Current"}
                </span>
              </div>

              {pub.staleMessage ? (
                <p className="mt-3 text-sm text-amber-100/75">{pub.staleMessage}</p>
              ) : null}

              {"strategySummary" in pub.payload &&
              typeof pub.payload.strategySummary === "string" &&
              pub.payload.strategySummary ? (
                <p className="mt-4 text-sm leading-relaxed text-[#F3F1EA]/65">
                  {pub.payload.strategySummary}
                </p>
              ) : null}

              {"agreedPriorities" in pub.payload &&
              Array.isArray(pub.payload.agreedPriorities) &&
              pub.payload.agreedPriorities.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {pub.payload.agreedPriorities.map((item: string) => (
                    <li
                      key={item}
                      className="rounded-sm border border-[#D1A866]/12 px-3 py-2 text-sm text-[#F3F1EA]/70"
                    >
                      {CLIENT_TERMINOLOGY.agreedPriority}: {item}
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-4 text-xs text-[#F3F1EA]/40">
                {pub.dataAsAt
                  ? CLIENT_TERMINOLOGY.dataAsAt(pub.dataAsAt)
                  : null}
                {pub.adviserName ? ` · Prepared by ${pub.adviserName}` : null}
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="mt-8">
        <ClientTrustNotice />
      </div>
    </>
  );
}

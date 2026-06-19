"use client";

import { useEffect, useState } from "react";

import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

const CATEGORY_LABELS: Record<string, string> = {
  financial_education: "Financial education",
  market_update: "Market update",
  planning_reminder: "Planning reminder",
  company_update: "Company update",
  event: "Event",
  regulatory_update: "Regulatory update",
  adviser_message: "Adviser message",
  document_notification: "Document notification",
  appointment_update: "Appointment update",
  review_reminder: "Review reminder",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

type InsightItem = {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  source: string | null;
  publicationDate: string | null;
  expiryDate: string | null;
  externalUrl: string | null;
  externalSourceName: string | null;
  adviserAttribution: string | null;
  isGeneralInformation: boolean;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function InsightsFeedClient() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/client/insights", { cache: "no-store" });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || !data.ok) {
          setError(data.error ?? "Failed to load updates");
          return;
        }

        setInsights(data.insights ?? []);
      } catch {
        if (!cancelled) setError("Failed to load updates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <ClientPortalHeader
        eyebrow={CLIENT_TERMINOLOGY.insightsAndUpdates}
        title="Insights & Updates"
        subtitle="Approved educational content and adviser communications from your advisory team."
      />

      {loading && (
        <p className="text-sm text-[#F3F1EA]/50">Loading updates…</p>
      )}

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}

      {!loading && !error && insights.length === 0 && (
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-6 py-10 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/65">
            No updates are available at the moment.
          </p>
          <p className="mt-3 text-xs text-[#F3F1EA]/40">
            General educational content requires adviser approval before publication.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {insights.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <article
              key={item.id}
              className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#D1A866]/70">
                    {categoryLabel(item.category)}
                  </p>
                  <h2 className="mt-1 text-lg font-light text-[#F3F1EA]">{item.title}</h2>
                </div>
                {item.isGeneralInformation && (
                  <span className="rounded-sm border border-[#D1A866]/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#F3F1EA]/45">
                    General information
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/60">
                {item.summary}
              </p>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#F3F1EA]/35">
                {item.publicationDate && (
                  <span>Published {formatDate(item.publicationDate)}</span>
                )}
                {item.expiryDate && (
                  <span>Review by {formatDate(item.expiryDate)}</span>
                )}
                {item.source && <span>Source: {item.source}</span>}
                {item.adviserAttribution && <span>{item.adviserAttribution}</span>}
              </div>

              {item.externalUrl && (
                <p className="mt-3">
                  <a
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#D1A866]/80 underline-offset-2 hover:underline"
                  >
                    Read external article
                    {item.externalSourceName ? ` (${item.externalSourceName})` : ""}
                  </a>
                  <span className="mt-1 block text-[10px] text-[#F3F1EA]/30">
                    This content is hosted by a third party.
                  </span>
                </p>
              )}

              {item.body && (
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="mt-3 text-xs text-[#D1A866]/70 hover:text-[#D1A866]"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}

              {expanded && item.body && (
                <p className="mt-3 whitespace-pre-wrap text-sm font-light leading-relaxed text-[#F3F1EA]/55">
                  {item.body}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-8">
        <ClientTrustNotice />
      </div>
    </>
  );
}

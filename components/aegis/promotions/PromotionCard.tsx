"use client";

import Link from "next/link";

import CallMyAdviserButton from "@/components/aegis/adviser/CallMyAdviserButton";
import type { AdviserContact } from "@/lib/aegis/adviserContact";
import type { PromotionRecord } from "@/lib/aegis/promotions";

type PromotionCardProps = {
  promotion: PromotionRecord;
  preview?: boolean;
  adviserContact?: AdviserContact | null;
};

function formatValidUntil(endsAt: string | null): string | null {
  if (!endsAt) {
    return null;
  }

  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function resolveCta(promotion: PromotionRecord): {
  kind: "url" | "call";
  href: string | null;
  label: string;
  external: boolean;
} {
  const label = promotion.ctaLabel?.trim() || "Call My Adviser";

  if (promotion.ctaUrl?.trim()) {
    const url = promotion.ctaUrl.trim();
    const external = url.startsWith("http://") || url.startsWith("https://");
    return { kind: "url", href: url, label, external };
  }

  return { kind: "call", href: null, label, external: false };
}

export default function PromotionCard({
  promotion,
  preview = false,
  adviserContact = null,
}: PromotionCardProps) {
  const validUntil = formatValidUntil(promotion.endsAt);
  const highlights = promotion.details?.highlights?.filter(Boolean) ?? [];
  const cta = resolveCta(promotion);

  return (
    <article
      className={`overflow-hidden rounded-sm border bg-[#10283A]/70 transition-colors ${
        preview
          ? "border-[#D1A866]/30"
          : "border-[#D1A866]/12 hover:border-[#D1A866]/22"
      }`}
    >
      {promotion.imageSignedUrl && (
        <div className="relative aspect-[21/9] overflow-hidden border-b border-[#D1A866]/10 bg-[#071B2A]/80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={promotion.imageSignedUrl}
            alt=""
            className="h-full w-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071B2A]/80 via-transparent to-transparent" />
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/8 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#D1A866]/90">
            {promotion.category}
          </span>
          {validUntil && (
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
              Valid until {validUntil}
            </span>
          )}
        </div>

        <h3 className="text-lg font-light leading-snug text-[#F3F1EA] sm:text-xl">
          {promotion.title}
        </h3>

        {promotion.subtitle && (
          <p className="mt-2 text-sm font-light leading-relaxed text-[#D1A866]/75">
            {promotion.subtitle}
          </p>
        )}

        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/55">
          {promotion.summary}
        </p>

        {highlights.length > 0 && (
          <ul className="mt-5 space-y-2 border-t border-[#D1A866]/8 pt-5">
            {highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex gap-3 text-sm font-light text-[#F3F1EA]/65"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#D1A866]/70" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        )}

        {promotion.details?.eligibility && (
          <p className="mt-4 text-xs font-light leading-relaxed text-[#F3F1EA]/40">
            <span className="uppercase tracking-[0.12em] text-[#F3F1EA]/30">
              Eligibility ·{" "}
            </span>
            {promotion.details.eligibility}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {cta.kind === "call" ? (
            <CallMyAdviserButton
              variant="compact"
              adviserName={adviserContact?.adviserName}
              adviserPhone={adviserContact?.adviserPhone}
              adviserCompany={adviserContact?.adviserCompany}
            />
          ) : cta.external ? (
            <a
              href={cta.href!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
            >
              {cta.label} →
            </a>
          ) : (
            <Link
              href={cta.href!}
              className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
            >
              {cta.label} →
            </Link>
          )}

          {promotion.attachmentSignedUrl && (
            <a
              href={promotion.attachmentSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/45 transition-colors hover:text-[#F3F1EA]/70"
            >
              View attachment
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

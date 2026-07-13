"use client";

import Link from "next/link";

import {
  CRM_V2_APPOINTMENTS_PATH,
  CRM_V2_COMMUNICATIONS_PATH,
  CRM_V2_OPERATIONS_PATH,
  CRM_V2_RELATIONSHIPS_PATH,
  CRM_V2_SERVICE_PATH,
} from "@/lib/crm-v2/navigation";
import type {
  AdviserTodayProjectionDto,
  TodayCardDto,
  TodaySectionDto,
} from "@/lib/crm-v2/today/types";

const QUICK_LINKS = [
  { label: "Appointments", href: CRM_V2_APPOINTMENTS_PATH },
  { label: "Relationships", href: CRM_V2_RELATIONSHIPS_PATH },
  { label: "Service", href: CRM_V2_SERVICE_PATH },
  { label: "Communications", href: CRM_V2_COMMUNICATIONS_PATH },
  { label: "Operations", href: CRM_V2_OPERATIONS_PATH },
] as const;

function severityClass(severity: TodayCardDto["severity"]): string {
  switch (severity) {
    case "urgent":
      return "border-l-[#E07A5F]";
    case "attention":
      return "border-l-[#D1A866]";
    default:
      return "border-l-[#6B8F71]";
  }
}

function severityLabel(severity: TodayCardDto["severity"]): string {
  switch (severity) {
    case "urgent":
      return "Urgent";
    case "attention":
      return "Attention";
    default:
      return "Info";
  }
}

function TodayCard({ card }: { card: TodayCardDto }) {
  return (
    <Link
      href={card.routeHref}
      className={`group block rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/60 p-4 border-l-4 ${severityClass(card.severity)} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/70`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#F3F1EA]/90">{card.title}</p>
          {card.clientDisplayName ? (
            <p className="mt-1 text-xs text-[#F3F1EA]/50">{card.clientDisplayName}</p>
          ) : null}
          {card.summary ? (
            <p className="mt-2 text-sm text-[#F3F1EA]/55">{card.summary}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-[#F3F1EA]/8 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#F3F1EA]/45">
          {severityLabel(card.severity)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#D1A866]/80">
        <span>{card.actionLabel}</span>
        {card.dueAt ? <span className="text-[#F3F1EA]/35">Due {card.dueAt.slice(0, 10)}</span> : null}
      </div>
    </Link>
  );
}

function TodaySection({ section }: { section: TodaySectionDto }) {
  return (
    <section aria-labelledby={`today-section-${section.key}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`today-section-${section.key}`}
          className="text-base font-medium text-[#F3F1EA]/85"
        >
          {section.label}
        </h2>
        <Link
          href={section.workspaceHref}
          className="text-xs text-[#D1A866]/75 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
        >
          Open workspace
        </Link>
      </div>

      {section.partialFailure ? (
        <p className="rounded-md border border-[#D1A866]/20 bg-[#D1A866]/5 px-3 py-2 text-xs text-[#F3F1EA]/55">
          Some sources could not be loaded for this section.
        </p>
      ) : null}

      {section.cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#F3F1EA]/10 px-4 py-6 text-sm text-[#F3F1EA]/40">
          {section.emptyMessage}
        </p>
      ) : (
        <ul className="space-y-3">
          {section.cards.map((card) => (
            <li key={card.id}>
              <TodayCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Props = {
  initialToday: AdviserTodayProjectionDto | null;
  loadError: string | null;
  featureDisabled: boolean;
};

export function AdviserTodayClient({ initialToday, loadError, featureDisabled }: Props) {
  if (featureDisabled) {
    return (
      <div className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/40 px-6 py-10 text-center">
        <p className="text-sm text-[#F3F1EA]/60">Today workspace is not enabled.</p>
      </div>
    );
  }

  if (loadError || !initialToday) {
    return (
      <div className="rounded-lg border border-[#E07A5F]/30 bg-[#E07A5F]/5 px-6 py-10 text-center">
        <p className="text-sm text-[#F3F1EA]/70">{loadError ?? "Unable to load Today workspace."}</p>
      </div>
    );
  }

  const today = initialToday;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[#D1A866]/60">{today.dateLabel}</p>
        <h1 className="text-2xl font-light text-[#F3F1EA]/95">
          {today.greeting}
        </h1>
        <p className="text-sm text-[#F3F1EA]/55">{today.summary}</p>
        {today.staleDataWarning ? (
          <p className="rounded-md border border-[#D1A866]/20 bg-[#D1A866]/5 px-3 py-2 text-xs text-[#F3F1EA]/55">
            {today.staleDataWarning}
          </p>
        ) : null}
      </header>

      <nav aria-label="Quick links" className="flex flex-wrap gap-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-[#F3F1EA]/12 px-3 py-1.5 text-xs text-[#F3F1EA]/70 hover:border-[#D1A866]/40 hover:text-[#D1A866]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {today.sourceFailures.length > 0 ? (
        <div
          role="status"
          className="rounded-lg border border-[#D1A866]/25 bg-[#D1A866]/5 px-4 py-3 text-sm text-[#F3F1EA]/60"
        >
          Some operating sources could not be refreshed. Authoritative workspaces remain available.
        </div>
      ) : null}

      {today.workQueuePanel ? (
        <section aria-labelledby="today-operating-queue" className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="today-operating-queue" className="text-sm font-medium text-[#F3F1EA]/80">
              Work queue panel (read-only)
            </h2>
            <span className="text-xs text-[#F3F1EA]/40">
              {today.workQueuePanel.itemCount} items · {today.workQueuePanel.overdueCount} overdue
            </span>
          </div>
          {today.workQueuePanel.topItems.length === 0 ? (
            <p className="mt-3 text-sm text-[#F3F1EA]/40">Queue is clear.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {today.workQueuePanel.topItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.routeHref}
                    className="block rounded-md px-2 py-2 text-sm text-[#F3F1EA]/70 hover:bg-[#F3F1EA]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
                  >
                    <span className="text-[#F3F1EA]/85">{item.title}</span>
                    <span className="ml-2 text-xs text-[#F3F1EA]/40">{item.clientDisplayName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        {today.sections.map((section) => (
          <TodaySection key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}

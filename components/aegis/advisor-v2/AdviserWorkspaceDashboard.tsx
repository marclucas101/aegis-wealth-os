import Link from "next/link";

import type { CrmRelationshipListItem } from "@/lib/crm-v2/relationships/types";
import {
  CRM_V2_APPOINTMENTS_PATH,
  CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
  CRM_V2_OPERATIONS_PATH,
  CRM_V2_PRIMARY_NAV,
  CRM_V2_RELATIONSHIPS_PATH,
  CRM_V2_REPORTS_PATH,
  CRM_V2_SERVICE_PATH,
  CRM_V2_TEMPLATES_PATH,
  CRM_V2_TODAY_PATH,
  CRM_V2_TOOLS_NAV_GROUPS,
  type CrmV2NavItem,
} from "@/lib/crm-v2/navigation";
import type {
  AdviserTodayProjectionDto,
  TodayCardDto,
  TodaySectionDto,
  TodaySectionKey,
} from "@/lib/crm-v2/today/types";

const TODAY_PREVIEW_SECTIONS: TodaySectionKey[] = [
  "schedule",
  "prepare",
  "client_requests",
  "follow_ups",
  "service_due",
  "reviews",
  "sync_operations",
];

const MAX_PREVIEW_CARDS = 3;

type Props = {
  today: AdviserTodayProjectionDto | null;
  todayUnavailable: boolean;
  relationships: CrmRelationshipListItem[];
  relationshipsTotalCount: number | null;
  relationshipsUnavailable: boolean;
};

function ToolLink({ item }: { item: CrmV2NavItem }) {
  return (
    <Link
      href={item.href}
      title={item.description}
      className="block rounded-sm border border-[#D1A866]/10 bg-[#10283A]/35 px-3 py-2.5 text-sm text-[#F3F1EA]/70 transition-colors hover:border-[#D1A866]/25 hover:bg-[#10283A]/55 hover:text-[#F3F1EA]"
    >
      {item.label}
    </Link>
  );
}

function PreviewCard({ card }: { card: TodayCardDto }) {
  return (
    <Link
      href={card.routeHref}
      className="block rounded-sm border border-[#F3F1EA]/8 bg-[#1A1F1C]/40 px-3 py-2.5 transition-colors hover:border-[#D1A866]/20 hover:bg-[#1A1F1C]/60"
    >
      <p className="text-sm text-[#F3F1EA]/85">{card.title}</p>
      {card.clientDisplayName ? (
        <p className="mt-0.5 text-xs text-[#F3F1EA]/45">{card.clientDisplayName}</p>
      ) : null}
      {card.summary ? (
        <p className="mt-1 text-xs text-[#F3F1EA]/40">{card.summary}</p>
      ) : null}
    </Link>
  );
}

function DashboardSection({
  title,
  description,
  workspaceHref,
  workspaceLabel,
  children,
}: {
  title: string;
  description: string;
  workspaceHref: string;
  workspaceLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-[#D1A866]/14 bg-[#10283A]/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium tracking-wide text-[#F3F1EA]/90">{title}</h2>
          <p className="mt-1 text-xs font-light leading-relaxed text-[#F3F1EA]/40">
            {description}
          </p>
        </div>
        <Link
          href={workspaceHref}
          className="shrink-0 text-xs text-[#D1A866]/80 underline-offset-4 hover:underline"
        >
          {workspaceLabel}
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function pickTodaySections(today: AdviserTodayProjectionDto | null): TodaySectionDto[] {
  if (!today) return [];
  return TODAY_PREVIEW_SECTIONS.map((key) =>
    today.sections.find((section) => section.key === key),
  ).filter((section): section is TodaySectionDto => Boolean(section));
}

function planningTools(): CrmV2NavItem[] {
  return (
    CRM_V2_TOOLS_NAV_GROUPS.find((group) => group.label === "Protection & planning")?.items ?? []
  );
}

function documentTools(): CrmV2NavItem[] {
  return (
    CRM_V2_TOOLS_NAV_GROUPS.find((group) => group.label === "Documents & meetings")?.items ?? []
  );
}

export default function AdviserWorkspaceDashboard({
  today,
  todayUnavailable,
  relationships,
  relationshipsTotalCount,
  relationshipsUnavailable,
}: Props) {
  const todaySections = pickTodaySections(today);
  const appointmentsSection = today?.sections.find((section) => section.key === "schedule");
  const serviceSections = today?.sections.filter((section) =>
    ["client_requests", "follow_ups", "service_due"].includes(section.key),
  );

  return (
    <div className="space-y-8">
      <header className="border-b border-[#D1A866]/12 pb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/75">
          AEGIS Adviser Workspace
        </p>
        <h1 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          {today?.greeting ?? "Welcome back"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
          {today?.summary ??
            "Your operating dashboard for today, relationships, service, advice tools, and operations."}
        </p>
        {today?.dateLabel ? (
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            {today.dateLabel}
          </p>
        ) : null}
      </header>

      <nav aria-label="Primary workspaces" className="flex flex-wrap gap-2">
        {CRM_V2_PRIMARY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-[#F3F1EA]/12 px-3 py-1.5 text-xs text-[#F3F1EA]/70 hover:border-[#D1A866]/40 hover:text-[#D1A866]/90"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-2">
        <DashboardSection
          title="Today"
          description="Upcoming appointments, preparation, requests, follow-ups, reviews, and operations alerts."
          workspaceHref={CRM_V2_TODAY_PATH}
          workspaceLabel="Open Today"
        >
          {todayUnavailable ? (
            <p className="text-sm text-[#F3F1EA]/40">Today workspace is not available right now.</p>
          ) : todaySections.length === 0 ? (
            <p className="text-sm text-[#F3F1EA]/40">No operating items to show yet.</p>
          ) : (
            <div className="space-y-4">
              {todaySections.map((section) => (
                <div key={section.key}>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/70">
                    {section.label}
                  </p>
                  {section.cards.length === 0 ? (
                    <p className="mt-2 text-xs text-[#F3F1EA]/35">{section.emptyMessage}</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {section.cards.slice(0, MAX_PREVIEW_CARDS).map((card) => (
                        <li key={card.id}>
                          <PreviewCard card={card} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Relationships"
          description="Client roster entry, recently viewed clients, and relationship health signals."
          workspaceHref={CRM_V2_RELATIONSHIPS_PATH}
          workspaceLabel="Open relationships"
        >
          {relationshipsUnavailable ? (
            <p className="text-sm text-[#F3F1EA]/40">
              Relationships workspace is not available right now.
            </p>
          ) : relationships.length === 0 ? (
            <p className="text-sm text-[#F3F1EA]/40">No relationships in your book yet.</p>
          ) : (
            <div className="space-y-2">
              {relationshipsTotalCount !== null ? (
                <p className="text-xs text-[#F3F1EA]/40">
                  {relationshipsTotalCount} relationship{relationshipsTotalCount === 1 ? "" : "s"} in your book
                </p>
              ) : null}
              <ul className="space-y-2">
                {relationships.map((relationship) => (
                  <li key={relationship.relationshipId}>
                    <Link
                      href={relationship.detailHref}
                      className="block rounded-sm border border-[#F3F1EA]/8 bg-[#1A1F1C]/40 px-3 py-2.5 transition-colors hover:border-[#D1A866]/20"
                    >
                      <p className="text-sm text-[#F3F1EA]/85">{relationship.displayName}</p>
                      <p className="mt-0.5 text-xs text-[#F3F1EA]/40">
                        {relationship.servicingStateLabel}
                        {relationship.reviewStatusLabel
                          ? ` · ${relationship.reviewStatusLabel}`
                          : ""}
                        {relationship.profileCompletenessLabel
                          ? ` · ${relationship.profileCompletenessLabel}`
                          : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/advisor/clients"
                className="inline-block text-xs text-[#D1A866]/75 underline-offset-4 hover:underline"
              >
                Open classic client roster
              </Link>
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Appointments"
          description="Upcoming appointments, create appointment, and appointment requests."
          workspaceHref={CRM_V2_APPOINTMENTS_PATH}
          workspaceLabel="Open appointments"
        >
          {!appointmentsSection || appointmentsSection.cards.length === 0 ? (
            <p className="text-sm text-[#F3F1EA]/40">
              {appointmentsSection?.emptyMessage ?? "No upcoming appointments to show."}
            </p>
          ) : (
            <ul className="space-y-2">
              {appointmentsSection.cards.slice(0, MAX_PREVIEW_CARDS).map((card) => (
                <li key={card.id}>
                  <PreviewCard card={card} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`${CRM_V2_APPOINTMENTS_PATH}/new`}
              className="text-xs text-[#D1A866]/80 underline-offset-4 hover:underline"
            >
              Create appointment
            </Link>
            <Link
              href="/advisor/appointments"
              className="text-xs text-[#F3F1EA]/40 underline-offset-4 hover:underline"
            >
              Legacy appointments
            </Link>
          </div>
        </DashboardSection>

        <DashboardSection
          title="Service"
          description="Open service commitments, client requests, and follow-ups."
          workspaceHref={CRM_V2_SERVICE_PATH}
          workspaceLabel="Open service"
        >
          {!serviceSections || serviceSections.every((section) => section.cards.length === 0) ? (
            <p className="text-sm text-[#F3F1EA]/40">No open service items to show right now.</p>
          ) : (
            <div className="space-y-3">
              {serviceSections
                .filter((section) => section.cards.length > 0)
                .map((section) => (
                  <div key={section.key}>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/70">
                      {section.label}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {section.cards.slice(0, 2).map((card) => (
                        <li key={card.id}>
                          <PreviewCard card={card} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Advice & planning tools"
          description="Shield diagnostic, protection reports, planning roadmap, and scoring workflows."
          workspaceHref="/advisor/protection-report"
          workspaceLabel="Protection report generator"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {planningTools().map((item) => (
              <ToolLink key={`${item.href}-${item.label}`} item={item} />
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          title="Documents & meeting tools"
          description="Binder, vault, Meeting Studio, and planning outputs."
          workspaceHref="/advisor/clients"
          workspaceLabel="Open client roster"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {documentTools().map((item) => (
              <ToolLink key={`${item.href}-${item.label}`} item={item} />
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          title="Operations"
          description="Reports, Google Calendar operations, templates, adviser profile, and classic fallback."
          workspaceHref={CRM_V2_OPERATIONS_PATH}
          workspaceLabel="Open operations"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <ToolLink item={{ label: "Reports", href: CRM_V2_REPORTS_PATH }} />
            <ToolLink item={{ label: "Templates", href: CRM_V2_TEMPLATES_PATH }} />
            <ToolLink
              item={{
                label: "Google Calendar Operations",
                href: CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
              }}
            />
            <ToolLink
              item={{
                label: "Google Calendar Setup",
                href: "/advisor/my-profile?section=calendar",
              }}
            />
            <ToolLink item={{ label: "Adviser Profile", href: "/advisor/my-profile" }} />
            <ToolLink
              item={{
                label: "Classic Adviser Workspace",
                href: "/advisor/classic",
                description: "Emergency fallback",
              }}
            />
          </div>
        </DashboardSection>
      </div>

      <p className="max-w-3xl text-xs font-light leading-relaxed text-[#F3F1EA]/30">
        Projections and drafts are advisory only. Confirm actions manually in the relevant workspace
        or governed flows. Communications and calendar sync remain manual.
      </p>
    </div>
  );
}

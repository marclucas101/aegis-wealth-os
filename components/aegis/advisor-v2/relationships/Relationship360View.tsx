"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import CrmV2SectionPanel from "@/components/aegis/advisor-v2/CrmV2SectionPanel";
import type { CrmRelationship360 } from "@/lib/crm-v2/relationships/types";
import {
  CRM_V2_RELATIONSHIP_TABS,
  buildRelationshipDetailHref,
  type CrmV2RelationshipTab,
} from "@/lib/crm-v2/relationships/routes";

const TAB_LABELS: Record<CrmV2RelationshipTab, string> = {
  overview: "Overview",
  "financial-plan": "Financial Plan",
  engagement: "Engagement",
  service: "Service",
  documents: "Documents",
  profile: "Relationship Profile",
};

interface Relationship360ViewProps {
  model: CrmRelationship360;
}

export default function Relationship360View({ model }: Relationship360ViewProps) {
  const router = useRouter();
  const activeTab = model.activeTab;

  function selectTab(tab: CrmV2RelationshipTab) {
    const href = buildRelationshipDetailHref(model.identity.relationshipId, tab);
    router.push(href);
  }

  const partialWarning = model.diagnostics.sourceWarnings.length > 0;

  return (
    <div className="space-y-6">
      <header className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/45 p-5 sm:p-6">
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#F3F1EA]/35">
          <Link
            href={model.header.listHref}
            className="text-[#D1A866]/80 underline-offset-2 hover:underline"
          >
            ← Relationships
          </Link>
        </p>
        <h1 className="mt-2 text-lg font-light text-[#F3F1EA] sm:text-xl">
          {model.header.displayName}
        </h1>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[#F3F1EA]/40">Servicing state</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.servicingStateLabel}</dd>
          </div>
          <div>
            <dt className="text-[#F3F1EA]/40">Stage</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.relationshipStageLabel}</dd>
          </div>
          <div>
            <dt className="text-[#F3F1EA]/40">Assigned adviser</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.adviserAssignmentLabel}</dd>
          </div>
          <div>
            <dt className="text-[#F3F1EA]/40">Review status</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.reviewStatusLabel}</dd>
          </div>
          <div>
            <dt className="text-[#F3F1EA]/40">Last engagement</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.lastEngagementLabel}</dd>
          </div>
          <div>
            <dt className="text-[#F3F1EA]/40">Next appointment</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.nextAppointmentLabel}</dd>
          </div>
          <div>
            <dt className="text-[#F3F1EA]/40">Open actions</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.openActionsLabel}</dd>
          </div>
          <div>
            <dt className="text-[#F3F1EA]/40">Data freshness</dt>
            <dd className="text-[#F3F1EA]/85">{model.header.dataFreshnessLabel}</dd>
          </div>
        </dl>
      </header>

      {partialWarning ? (
        <div
          role="status"
          className="rounded-sm border border-amber-400/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/85"
        >
          Some sources could not be loaded. Sections may show partial data.
        </div>
      ) : null}

      <nav aria-label="Relationship 360 sections" className="flex flex-wrap gap-2">
        {CRM_V2_RELATIONSHIP_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => selectTab(tab)}
            aria-current={activeTab === tab ? "page" : undefined}
            className={`rounded-sm px-3 py-2 text-xs uppercase tracking-[0.14em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60 ${
              activeTab === tab
                ? "border border-[#D1A866]/30 bg-[#D1A866]/12 text-[#F3F1EA]"
                : "border border-[#D1A866]/12 text-[#F3F1EA]/55 hover:text-[#F3F1EA]"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <CrmV2SectionPanel title="Overview">
          <div className="grid gap-3 sm:grid-cols-2">
            {model.overview.panels.map((panel) => (
              <div
                key={panel.panelId}
                className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 p-4"
              >
                <h3 className="text-[9px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
                  {panel.title}
                </h3>
                <p className="mt-2 text-sm text-[#F3F1EA]/85">{panel.value}</p>
                {panel.detailHref ? (
                  <Link
                    href={panel.detailHref}
                    className="mt-2 inline-block text-xs text-[#D1A866]/80 underline-offset-2 hover:underline"
                  >
                    Open workflow
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[#F3F1EA]/45">{model.overview.protectionNotice}</p>
        </CrmV2SectionPanel>
      ) : null}

      {activeTab === "financial-plan" ? (
        <CrmV2SectionPanel title="Financial Plan">
          <ul className="space-y-3">
            {model.financialPlan.links.map((link) => (
              <li
                key={link.href + link.label}
                className="flex flex-col gap-1 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/35 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={link.href}
                    className="text-sm text-[#F3F1EA] underline-offset-2 hover:underline"
                  >
                    {link.label}
                  </Link>
                  <p className="text-xs text-[#F3F1EA]/45">{link.statusLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        </CrmV2SectionPanel>
      ) : null}

      {activeTab === "engagement" ? (
        <CrmV2SectionPanel title="Engagement timeline">
          {model.engagement.timeline.length === 0 ? (
            <p className="text-sm text-[#F3F1EA]/50">No engagement events on file.</p>
          ) : (
            <ol className="space-y-3">
              {model.engagement.timeline.map((entry) => (
                <li
                  key={entry.eventId}
                  className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/35 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm text-[#F3F1EA]">{entry.title}</h3>
                    <time className="text-xs text-[#F3F1EA]/45" dateTime={entry.occurredAt}>
                      {new Date(entry.occurredAt).toLocaleString("en-SG")}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-[#F3F1EA]/55">{entry.summary}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
                    {entry.eventType.replace(/_/g, " ")} · {entry.visibility.replace(/_/g, " ")}
                  </p>
                  {entry.sourceLink ? (
                    <Link
                      href={entry.sourceLink}
                      className="mt-2 inline-block text-xs text-[#D1A866]/80 underline-offset-2 hover:underline"
                    >
                      View source
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {model.engagement.bounded ? (
            <p className="mt-3 text-xs text-[#F3F1EA]/40">Timeline is bounded to recent events.</p>
          ) : null}
        </CrmV2SectionPanel>
      ) : null}

      {activeTab === "service" ? (
        <CrmV2SectionPanel title="Service">
          <p className="mb-4 text-xs text-[#F3F1EA]/45">{model.service.phaseNotice}</p>
          {model.service.items.length === 0 ? (
            <p className="text-sm text-[#F3F1EA]/50">No service items projected.</p>
          ) : (
            <ul className="space-y-3">
              {model.service.items.map((item) => (
                <li
                  key={item.itemId}
                  className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/35 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="text-sm text-[#F3F1EA]">{item.summary}</h3>
                    <span className="text-xs text-[#F3F1EA]/50">{item.statusLabel}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#F3F1EA]/45">
                    {item.source} · Due {item.dueDateLabel}
                  </p>
                  {item.workflowHref ? (
                    <Link
                      href={item.workflowHref}
                      className="mt-2 inline-block text-xs text-[#D1A866]/80 underline-offset-2 hover:underline"
                    >
                      Open workflow
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CrmV2SectionPanel>
      ) : null}

      {activeTab === "documents" ? (
        <CrmV2SectionPanel title="Documents">
          <p className="mb-4">
            <Link
              href={model.documents.vaultHref}
              className="text-sm text-[#D1A866]/85 underline-offset-2 hover:underline"
            >
              Open document vault
            </Link>
          </p>
          <ul className="space-y-3">
            {model.documents.items.map((item) => (
              <li
                key={item.itemId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/35 p-4"
              >
                <div>
                  <p className="text-sm text-[#F3F1EA]">{item.categoryLabel}</p>
                  <p className="text-xs text-[#F3F1EA]/45">
                    {item.statusLabel} · {item.updatedLabel}
                  </p>
                </div>
                {item.workflowHref ? (
                  <Link
                    href={item.workflowHref}
                    className="text-xs text-[#D1A866]/80 underline-offset-2 hover:underline"
                  >
                    View
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </CrmV2SectionPanel>
      ) : null}

      {activeTab === "profile" ? (
        <CrmV2SectionPanel title="Relationship Profile">
          <dl className="grid gap-3 sm:grid-cols-2">
            {model.profile.fields.map((field) => (
              <div key={field.label}>
                <dt className="text-[9px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
                  {field.label}
                </dt>
                <dd className="mt-1 text-sm text-[#F3F1EA]/85">{field.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-6 space-y-1 text-xs text-[#F3F1EA]/40">
            {model.profile.futurePhaseNotices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </CrmV2SectionPanel>
      ) : null}
    </div>
  );
}

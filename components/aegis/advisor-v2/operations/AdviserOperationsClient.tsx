"use client";

import Link from "next/link";

import type {
  AdviserOperationsProjectionDto,
  FeatureControlStatusDto,
  OperationsPanelDto,
  OperationsSectionDto,
} from "@/lib/crm-v2/operations/types";

function statusLabel(level: OperationsPanelDto["statusLevel"]): string {
  switch (level) {
    case "healthy":
      return "Healthy";
    case "attention":
      return "Attention";
    case "warning":
      return "Warning";
    default:
      return "Unknown";
  }
}

function statusClass(level: OperationsPanelDto["statusLevel"]): string {
  switch (level) {
    case "healthy":
      return "border-l-[#6B8F71]";
    case "attention":
      return "border-l-[#D1A866]";
    case "warning":
      return "border-l-[#E07A5F]";
    default:
      return "border-l-[#F3F1EA]/20";
  }
}

function OperationsPanel({ panel }: { panel: OperationsPanelDto }) {
  const content = (
    <div
      className={`rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/60 p-4 border-l-4 ${statusClass(panel.statusLevel)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#F3F1EA]/90">{panel.title}</p>
          <p className="mt-1 text-xs text-[#F3F1EA]/45">{panel.sourceModule}</p>
          <p className="mt-2 text-sm text-[#F3F1EA]/55">{panel.summary}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#F3F1EA]/8 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#F3F1EA]/45">
          {statusLabel(panel.statusLevel)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#F3F1EA]/40">
        {panel.safeCount !== null ? <span>Count: {panel.safeCount}</span> : null}
        {panel.actionLabel ? <span className="text-[#D1A866]/80">{panel.actionLabel}</span> : null}
      </div>
    </div>
  );

  if (panel.routeHref) {
    return (
      <Link
        href={panel.routeHref}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/70"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function FeatureControlsTable({ controls }: { controls: FeatureControlStatusDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#F3F1EA]/10">
      <table className="min-w-full text-left text-xs text-[#F3F1EA]/70">
        <thead className="bg-[#1A1F1C]/80 text-[#F3F1EA]/50">
          <tr>
            <th className="px-3 py-2 font-medium">Feature key</th>
            <th className="px-3 py-2 font-medium">Enabled</th>
            <th className="px-3 py-2 font-medium">Adviser visible</th>
            <th className="px-3 py-2 font-medium">Client visible</th>
          </tr>
        </thead>
        <tbody>
          {controls.map((row) => (
            <tr key={row.featureKey} className="border-t border-[#F3F1EA]/10">
              <td className="px-3 py-2 font-mono text-[11px]">{row.featureKey}</td>
              <td className="px-3 py-2">{row.enabled ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{row.adviserVisible ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{row.clientVisible ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OperationsSection({ section }: { section: OperationsSectionDto }) {
  return (
    <section aria-labelledby={`operations-section-${section.key}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`operations-section-${section.key}`} className="text-base font-medium text-[#F3F1EA]/85">
          {section.label}
        </h2>
        {section.workspaceHref ? (
          <Link
            href={section.workspaceHref}
            className="text-xs text-[#D1A866]/75 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
          >
            Open workspace
          </Link>
        ) : null}
      </div>

      {section.partialFailure ? (
        <p className="rounded-md border border-[#D1A866]/20 bg-[#D1A866]/5 px-3 py-2 text-xs text-[#F3F1EA]/55">
          Some sources could not be loaded for this section.
        </p>
      ) : null}

      {section.featureControls && section.featureControls.length > 0 ? (
        <FeatureControlsTable controls={section.featureControls} />
      ) : null}

      {section.panels.length === 0 && !section.featureControls?.length ? (
        <p className="rounded-lg border border-dashed border-[#F3F1EA]/10 px-4 py-6 text-sm text-[#F3F1EA]/40">
          {section.emptyMessage}
        </p>
      ) : (
        <ul className="space-y-3">
          {section.panels.map((panel) => (
            <li key={panel.panelKey}>
              <OperationsPanel panel={panel} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Props = {
  initialOperations: AdviserOperationsProjectionDto | null;
  loadError: string | null;
  featureDisabled: boolean;
};

export function AdviserOperationsClient({ initialOperations, loadError, featureDisabled }: Props) {
  if (featureDisabled) {
    return (
      <div className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/40 px-6 py-10 text-center">
        <p className="text-sm text-[#F3F1EA]/60">CRM V2 Operations is not enabled.</p>
      </div>
    );
  }

  if (loadError || !initialOperations) {
    return (
      <div className="rounded-lg border border-[#E07A5F]/20 bg-[#E07A5F]/5 px-6 py-10 text-center">
        <p className="text-sm text-[#F3F1EA]/60">{loadError ?? "Unable to load operations."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/40 px-4 py-3">
        <p className="text-sm text-[#F3F1EA]/70">
          Platform health, sync and migration visibility — no secrets or raw provider payloads.
        </p>
        {initialOperations.adminScopeDeferred ? (
          <p className="mt-2 text-xs text-[#D1A866]/80">
            Adviser-scoped panels are deferred for admin book-wide view.
          </p>
        ) : null}
        {initialOperations.environmentWarnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-[#D1A866]/80">
            {initialOperations.environmentWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="grid gap-8">
        {initialOperations.sections.map((section) => (
          <OperationsSection key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}

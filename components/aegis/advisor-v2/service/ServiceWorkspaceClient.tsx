"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import CrmV2SectionPanel from "@/components/aegis/advisor-v2/CrmV2SectionPanel";
import type { CrmServiceMyWorkItem, CrmServiceWorkspaceView } from "@/lib/crm-v2/service/types";
import type { AdviserCommitmentDto, AdviserServiceRequestDto } from "@/lib/crm-v2/service/types";

const VIEWS: Array<{ key: CrmServiceWorkspaceView; label: string }> = [
  { key: "my_work", label: "My Work" },
  { key: "client_requests", label: "Client Requests" },
  { key: "reviews", label: "Reviews" },
  { key: "commitments", label: "Commitments" },
  { key: "documents_required", label: "Documents Required" },
  { key: "workflow_cases", label: "Workflow Cases" },
  { key: "completed", label: "Completed" },
];

interface ServiceWorkspaceClientProps {
  initialView: CrmServiceWorkspaceView;
  initialMyWork: CrmServiceMyWorkItem[];
  initialRequests: AdviserServiceRequestDto[];
  initialCommitments: AdviserCommitmentDto[];
  initialReviews: CrmServiceMyWorkItem[];
  initialDocuments: CrmServiceMyWorkItem[];
  initialCompleted: CrmServiceMyWorkItem[];
}

export default function ServiceWorkspaceClient({
  initialView,
  initialMyWork,
  initialRequests,
  initialCommitments,
  initialReviews,
  initialDocuments,
  initialCompleted,
}: ServiceWorkspaceClientProps) {
  const [view, setView] = useState<CrmServiceWorkspaceView>(initialView);
  const [myWork] = useState(initialMyWork);
  const [requests] = useState(initialRequests);
  const [commitments] = useState(initialCommitments);
  const [reviews] = useState(initialReviews);
  const [documents] = useState(initialDocuments);
  const [completed] = useState(initialCompleted);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createCommitment = useCallback(async () => {
    const relationshipId = window.prompt("Relationship ID (client UUID)");
    const title = window.prompt("Commitment title");
    if (!relationshipId || !title) return;

    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/advisor-v2/service/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipId,
          owner: "adviser",
          title,
          clientVisible: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to create commitment");
        return;
      }
      window.location.reload();
    } catch {
      setError("Failed to create commitment");
    } finally {
      setCreating(false);
    }
  }, []);

  function renderItems(items: CrmServiceMyWorkItem[]) {
    if (items.length === 0) {
      return (
        <p className="text-sm text-[#F3F1EA]/60">No items in this view.</p>
      );
    }
    return (
      <ul className="space-y-3" role="list">
        {items.map((item) => (
          <li
            key={item.itemId}
            className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A2332]/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#C9A227]">{item.source}</p>
                <p className="mt-1 font-medium text-[#F3F1EA]">{item.summary}</p>
                {item.relationshipDisplayName ? (
                  <p className="mt-1 text-sm text-[#F3F1EA]/70">{item.relationshipDisplayName}</p>
                ) : null}
                <p className="mt-1 text-sm text-[#F3F1EA]/60">Status: {item.statusLabel}</p>
              </div>
              <Link
                href={item.workflowHref}
                className="text-sm text-[#C9A227] underline-offset-2 hover:underline"
              >
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function renderRequests() {
    if (requests.length === 0) {
      return <p className="text-sm text-[#F3F1EA]/60">No open client requests.</p>;
    }
    return (
      <ul className="space-y-3" role="list">
        {requests.map((req) => (
          <li
            key={req.requestId}
            className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A2332]/60 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[#C9A227]">{req.categoryLabel}</p>
            <p className="mt-1 font-medium text-[#F3F1EA]">{req.summary}</p>
            <p className="mt-1 text-sm text-[#F3F1EA]/70">
              {req.relationshipDisplayName ?? "Relationship"}
            </p>
            <p className="mt-1 text-sm text-[#F3F1EA]/60">
              {req.clientVisibleStatus} · Next: {req.nextExpectedAction}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  function renderCommitments() {
    if (commitments.length === 0) {
      return <p className="text-sm text-[#F3F1EA]/60">No open commitments.</p>;
    }
    return (
      <ul className="space-y-3" role="list">
        {commitments.map((c) => (
          <li
            key={c.commitmentId}
            className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A2332]/60 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[#C9A227]">
              {c.owner} · {c.commitmentType.replace(/_/g, " ")}
            </p>
            <p className="mt-1 font-medium text-[#F3F1EA]">{c.title}</p>
            <p className="mt-1 text-sm text-[#F3F1EA]/60">{c.lifecycleLabel}</p>
          </li>
        ))}
      </ul>
    );
  }

  let panelTitle = "My Work";
  let panelContent = renderItems(myWork);
  if (view === "client_requests") {
    panelTitle = "Client Requests";
    panelContent = renderRequests();
  } else if (view === "reviews") {
    panelTitle = "Reviews";
    panelContent = renderItems(reviews);
  } else if (view === "commitments") {
    panelTitle = "Commitments";
    panelContent = renderCommitments();
  } else if (view === "documents_required") {
    panelTitle = "Documents Required";
    panelContent = renderItems(documents);
  } else if (view === "workflow_cases") {
    panelTitle = "Workflow Cases";
    panelContent = (
      <p className="text-sm text-[#F3F1EA]/60">
        Workflow cases reuse existing review and appointment authorities. No generic case platform introduced in Phase 06.
      </p>
    );
  } else if (view === "completed") {
    panelTitle = "Completed";
    panelContent = renderItems(completed);
  }

  return (
    <div className="space-y-6">
      <CrmV2PageHeader
        title="Service"
        subtitle="Commitments, client requests and servicing projections across authoritative sources."
      />
      <div className="mb-4">
        <button
          type="button"
          onClick={() => void createCommitment()}
          disabled={creating}
          className="rounded-md bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0F1A2A] disabled:opacity-50"
        >
          {creating ? "Creating…" : "New commitment"}
        </button>
      </div>

      <nav aria-label="Service views" className="flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <Link
            key={item.key}
            href={`/advisor-v2/service?view=${item.key}`}
            onClick={() => setView(item.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              view === item.key
                ? "bg-[#C9A227] text-[#0F1A2A]"
                : "border border-[#F3F1EA]/20 text-[#F3F1EA]/80 hover:border-[#C9A227]/50"
            }`}
            aria-current={view === item.key ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <CrmV2SectionPanel title={panelTitle}>{panelContent}</CrmV2SectionPanel>
    </div>
  );
}

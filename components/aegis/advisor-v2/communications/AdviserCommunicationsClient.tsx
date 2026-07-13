"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  AdviserCommunicationRecordDto,
  AdviserCommunicationsWorkspaceDto,
  CrmCommunicationChannel,
  CrmCommunicationWorkspaceView,
} from "@/lib/crm-v2/communications/types";
import { channelLabel, lifecycleLabel } from "@/lib/crm-v2/communications/types";

const VIEWS: Array<{ id: CrmCommunicationWorkspaceView; label: string }> = [
  { id: "drafts", label: "Drafts" },
  { id: "needs_review", label: "Needs Review" },
  { id: "recent", label: "Recent Communications" },
  { id: "templates", label: "Templates" },
  { id: "follow_ups", label: "Follow-ups" },
  { id: "action_required", label: "Failed / Action Required" },
];

const CHANNELS: CrmCommunicationChannel[] = [
  "internal_client_message",
  "email_draft",
  "phone_call_log",
  "whatsapp_draft",
  "sms_draft",
  "external_message_log",
];

type Props = {
  initialView: CrmCommunicationWorkspaceView;
  initialWorkspace: AdviserCommunicationsWorkspaceDto | null;
  loadError: string | null;
};

function recordsForView(
  workspace: AdviserCommunicationsWorkspaceDto,
  view: CrmCommunicationWorkspaceView,
): AdviserCommunicationRecordDto[] {
  switch (view) {
    case "needs_review":
      return workspace.needsReview;
    case "recent":
      return workspace.recent;
    case "follow_ups":
      return workspace.followUps;
    case "action_required":
      return workspace.actionRequired;
    case "templates":
      return [];
    default:
      return workspace.drafts;
  }
}

export function AdviserCommunicationsClient({
  initialView,
  initialWorkspace,
  loadError,
}: Props) {
  const [view, setView] = useState<CrmCommunicationWorkspaceView>(initialView);
  const [workspace, setWorkspace] = useState<AdviserCommunicationsWorkspaceDto | null>(
    initialWorkspace,
  );
  const [error, setError] = useState<string | null>(loadError);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [channel, setChannel] = useState<CrmCommunicationChannel>("internal_client_message");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function refreshWorkspace(nextView = view) {
    setError(null);
    try {
      const res = await fetch(`/api/advisor-v2/communications?view=${nextView}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.reason === "feature_disabled"
            ? "Communications is not enabled."
            : "Unable to load communications workspace.",
        );
        return;
      }
      setWorkspace(data.workspace);
    } catch {
      setError("Unable to load communications workspace.");
    }
  }

  async function createDraft() {
    setActionMessage(null);
    setError(null);
    if (!clientId.trim() || !subject.trim()) {
      setError("Client ID and subject are required.");
      return;
    }
    try {
      const res = await fetch("/api/advisor-v2/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          channel,
          safeSubject: subject.trim(),
          safeBody: body.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unable to create draft.");
        return;
      }
      setActionMessage("Draft created.");
      setSubject("");
      setBody("");
      await refreshWorkspace();
    } catch {
      setError("Unable to create draft.");
    }
  }

  const items = workspace ? recordsForView(workspace, view) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Communications</h1>
        <p className="mt-1 text-sm text-slate-600">
          Governed drafts and logs only — no automatic external send.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Communications views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setView(item.id);
              void refreshWorkspace(item.id);
            }}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === item.id
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {actionMessage}
        </div>
      )}

      {view === "templates" && workspace && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-slate-900">Approved templates</h2>
          {workspace.templates.length === 0 ? (
            <p className="text-sm text-slate-600">No approved templates.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {workspace.templates.map((template) => (
                <li key={template.templateId} className="px-4 py-3">
                  <p className="font-medium text-slate-900">{template.title}</p>
                  <p className="text-xs text-slate-500">
                    {template.category} · {channelLabel(template.channel)} · v{template.version}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{template.bodyPreview}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view !== "templates" && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-slate-900">
            {VIEWS.find((v) => v.id === view)?.label}
          </h2>
          {items.length === 0 ? (
            <p className="text-sm text-slate-600">No communications in this view.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {items.map((record) => (
                <li key={record.recordId} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{record.safeSubject}</p>
                      <p className="text-xs text-slate-500">
                        {record.clientDisplayName ?? record.clientId} ·{" "}
                        {channelLabel(record.channel)} · {lifecycleLabel(record.lifecycleStatus)}
                      </p>
                      {record.safeBodyPreview && (
                        <p className="mt-1 text-sm text-slate-600">{record.safeBodyPreview}</p>
                      )}
                      {record.preferenceWarnings.length > 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          Preference warnings: {record.preferenceWarnings.join(", ")}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/advisor-v2/relationships/${record.clientId}`}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      Relationship 360
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-md border border-slate-200 p-4">
        <h2 className="text-lg font-medium text-slate-900">Create draft or log</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-700">Client ID</span>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CrmCommunicationChannel)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {channelLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-slate-700">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-slate-700">Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void createDraft()}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          Create draft
        </button>
      </section>
    </div>
  );
}

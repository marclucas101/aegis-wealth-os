"use client";

import { useState } from "react";

import type { ClientMessagesInboxDto } from "@/lib/crm-v2/communications/types";

type Props = {
  initialInbox: ClientMessagesInboxDto | null;
  loadError: string | null;
};

export function ClientMessagesClient({ initialInbox, loadError }: Props) {
  const [inbox, setInbox] = useState<ClientMessagesInboxDto | null>(initialInbox);
  const [error, setError] = useState<string | null>(loadError);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const selected = inbox?.messages.find((m) => m.messageId === selectedId) ?? null;

  async function refreshInbox() {
    setError(null);
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.reason === "feature_disabled"
            ? "Messages are not enabled."
            : "Unable to load messages.",
        );
        return;
      }
      setInbox(data.inbox);
    } catch {
      setError("Unable to load messages.");
    }
  }

  async function sendReply() {
    if (!selected) return;
    setActionMessage(null);
    try {
      const res = await fetch(`/api/messages/${selected.messageId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safeBody: replyBody, expectedVersion: selected.version }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unable to send reply.");
        return;
      }
      setActionMessage("Reply sent.");
      setReplyBody("");
      await refreshInbox();
    } catch {
      setError("Unable to send reply.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-600">Client-visible adviser messages only.</p>
      </header>

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

      {inbox?.preferenceWarnings && inbox.preferenceWarnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Preference notice: {inbox.preferenceWarnings.join(", ")}.{" "}
          <a href="/preferences/communications" className="underline">
            Update preferences
          </a>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
          {(inbox?.messages ?? []).map((message) => (
            <li key={message.messageId}>
              <button
                type="button"
                onClick={() => setSelectedId(message.messageId)}
                className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                  selectedId === message.messageId ? "bg-slate-100" : ""
                }`}
              >
                <p className="font-medium text-slate-900">{message.safeSubject}</p>
                <p className="text-xs text-slate-500">
                  {new Date(message.occurredAt).toLocaleDateString()}
                </p>
              </button>
            </li>
          ))}
          {(inbox?.messages ?? []).length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-600">No messages yet.</li>
          )}
        </ul>

        <div className="rounded-md border border-slate-200 p-4">
          {selected ? (
            <>
              <h2 className="text-lg font-medium text-slate-900">{selected.safeSubject}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{selected.safeBody}</p>
              {selected.canReply && (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Your reply"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply()}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                  >
                    Send reply
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">Select a message to read.</p>
          )}
        </div>
      </div>
    </div>
  );
}

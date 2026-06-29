"use client";

import { useState } from "react";

type IntegrationStatus = {
  connection: {
    connected: boolean;
    calendarId: string | null;
    calendarEmail: string | null;
    connectedAt: string | null;
    revoked: boolean;
  };
  selectedCalendarId: string | null;
  selectedCalendarEmail: string | null;
  lastSuccessfulSyncAt: string | null;
  pendingSyncCount: number;
  failedSyncCount: number;
  actionRequiredCount: number;
};

interface Props {
  initialStatus: IntegrationStatus;
}

export default function GoogleCalendarIntegrationClient({ initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);

  async function reloadStatus() {
    const response = await fetch("/api/advisor-v2/integrations/google-calendar/status", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; status?: IntegrationStatus };
    if (response.ok && payload.ok && payload.status) {
      setStatus(payload.status);
    }
  }

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const response = await fetch("/api/advisor-v2/integrations/google-calendar/connect", {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: boolean; authorizeUrl?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.authorizeUrl) {
        setError(payload.error ?? "Failed to start OAuth");
        return;
      }
      window.location.assign(payload.authorizeUrl);
    } catch {
      setError("Failed to start OAuth");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setError(null);
    try {
      const response = await fetch("/api/advisor-v2/integrations/google-calendar/disconnect", {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to disconnect");
        return;
      }
      await reloadStatus();
    } catch {
      setError("Failed to disconnect");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Google Calendar Integration</h2>
      <p className="text-sm text-slate-700">
        AEGIS remains the authoritative appointment system. Google Calendar is a sync target only.
      </p>
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-600">Connection</dt>
          <dd>{status.connection.connected ? "Connected" : "Not connected"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-600">Selected calendar</dt>
          <dd>{status.selectedCalendarEmail ?? status.selectedCalendarId ?? "Not selected"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-600">Last successful sync</dt>
          <dd>{status.lastSuccessfulSyncAt ?? "Never"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-600">Pending / Failed / Action required</dt>
          <dd>
            {status.pendingSyncCount} / {status.failedSyncCount} / {status.actionRequiredCount}
          </dd>
        </div>
      </dl>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy !== null}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900"
        >
          {status.connection.connected ? "Reconnect Google" : "Connect Google"}
        </button>
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={busy !== null || !status.connection.connected}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

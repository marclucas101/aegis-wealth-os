"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RoadmapAction = {
  id: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  task_owner: "client" | "adviser";
  client_visible: boolean;
  display_category: string | null;
  timeline_months: number;
  priority: "low" | "medium" | "high" | "critical";
};

interface AdvisorClientRoadmapEditorProps {
  clientId: string;
  returnTab?: string;
}

export default function AdvisorClientRoadmapEditor({
  clientId,
  returnTab = "meeting-packs",
}: AdvisorClientRoadmapEditorProps) {
  const [actions, setActions] = useState<RoadmapAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskOwner, setTaskOwner] = useState<"client" | "adviser">("client");
  const [clientVisible, setClientVisible] = useState(true);

  const returnHref =
    returnTab === "planning-outputs"
      ? `/advisor/clients/${clientId}/planning-outputs?focus=roadmap&returnTab=meeting-packs`
      : `/advisor/clients/${clientId}?tab=${encodeURIComponent(returnTab)}&returnTab=${encodeURIComponent(returnTab)}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/advisor/clients/${clientId}/roadmap-actions`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          ok: boolean;
          actions?: RoadmapAction[];
          error?: { message?: string };
        };
        if (cancelled) return;
        if (!response.ok || !data.ok || !data.actions) {
          throw new Error(data.error?.message ?? "Unable to load roadmap actions.");
        }
        setActions(data.actions);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load roadmap actions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function reloadActions() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/roadmap-actions`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        ok: boolean;
        actions?: RoadmapAction[];
        error?: { message?: string };
      };
      if (!response.ok || !data.ok || !data.actions) {
        throw new Error(data.error?.message ?? "Unable to load roadmap actions.");
      }
      setActions(data.actions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load roadmap actions.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/roadmap-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          taskOwner,
          clientVisible,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message ?? "Unable to create roadmap action.");
      }
      setTitle("");
      setDescription("");
      await reloadActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create roadmap action.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(actionId: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/roadmap-actions/${actionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archive: true }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message ?? "Unable to archive roadmap action.");
      }
      await reloadActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive roadmap action.");
    } finally {
      setSaving(false);
    }
  }

  const clientVisibleCount = actions.filter((row) => row.client_visible).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#F3F1EA] sm:text-2xl">Roadmap actions</h3>
          <p className="mt-2 max-w-2xl text-sm text-[#F3F1EA]/70">
            Add client-visible actions before preparing the wealth roadmap output. Publication to
            the client vault remains a separate step in Planning outputs.
          </p>
        </div>
        <Link
          href={returnHref}
          className="inline-flex shrink-0 items-center justify-center rounded border border-[#D1A866]/35 px-4 py-2 text-sm font-medium text-[#F3F1EA]/90 transition hover:border-[#107A5E]/50 hover:text-[#107A5E]"
        >
          Back to {returnTab === "planning-outputs" ? "planning outputs" : "meeting packs"}
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleCreate(event)}
        className="space-y-4 rounded-xl border border-[#10283A]/10 bg-white p-5"
      >
        <h4 className="font-medium text-[#10283A]">Add roadmap action</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-[#10283A]">
            Action title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded border border-[#10283A]/20 px-3 py-2"
              placeholder="Review protection cover"
              required
            />
          </label>
          <label className="block text-sm text-[#10283A]">
            Owner
            <select
              value={taskOwner}
              onChange={(event) => setTaskOwner(event.target.value as "client" | "adviser")}
              className="mt-1 w-full rounded border border-[#10283A]/20 px-3 py-2"
            >
              <option value="client">Client action</option>
              <option value="adviser">Adviser action</option>
            </select>
          </label>
        </div>
        <label className="block text-sm text-[#10283A]">
          Client-safe description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded border border-[#10283A]/20 px-3 py-2"
            rows={3}
            placeholder="Brief description the client can read in their roadmap."
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#10283A]">
          <input
            type="checkbox"
            checked={clientVisible}
            onChange={(event) => setClientVisible(event.target.checked)}
          />
          Visible to client in roadmap and wealth-roadmap preparation
        </label>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded bg-[#107A5E] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add action"}
        </button>
      </form>

      <div className="rounded-xl border border-[#10283A]/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-medium text-[#10283A]">Current actions</h4>
          <span className="text-xs text-[#10283A]/60">
            {clientVisibleCount} client-visible action{clientVisibleCount === 1 ? "" : "s"}
          </span>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-[#10283A]/60">Loading actions…</p>
        ) : actions.length === 0 ? (
          <p className="mt-4 text-sm text-[#10283A]/70">
            No roadmap actions have been created for this client.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[#10283A]/10">
            {actions.map((action) => (
              <li key={action.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-[#10283A]">{action.title}</p>
                  {action.display_category ? (
                    <p className="mt-1 text-xs text-[#10283A]/60">{action.display_category}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[#10283A]/50">
                    {action.task_owner === "adviser" ? "Adviser" : "Client"} ·{" "}
                    {action.client_visible ? "Client-visible" : "Internal"} ·{" "}
                    {action.status.replace(/_/g, " ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleArchive(action.id)}
                  className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A] disabled:opacity-50"
                >
                  Archive
                </button>
              </li>
            ))}
          </ul>
        )}
        {clientVisibleCount > 0 ? (
          <Link
            href={`/advisor/clients/${clientId}/planning-outputs?focus=roadmap&returnTab=meeting-packs`}
            className="mt-4 inline-flex rounded bg-[#10283A] px-4 py-2 text-sm text-white"
          >
            Create wealth-roadmap draft
          </Link>
        ) : null}
      </div>
    </div>
  );
}

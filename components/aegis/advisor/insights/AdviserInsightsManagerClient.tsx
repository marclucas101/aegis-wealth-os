"use client";

import { useEffect, useState } from "react";

import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";

type ContentItem = {
  id: string;
  title: string;
  summary: string;
  category: string;
  approvalStatus: string;
  audienceScope: string;
  version: number;
  updatedAt: string;
};

const CATEGORIES = [
  { value: "financial_education", label: "Financial education" },
  { value: "market_update", label: "Market update" },
  { value: "adviser_message", label: "Adviser message" },
  { value: "company_update", label: "Company update" },
  { value: "event", label: "Event" },
  { value: "planning_reminder", label: "Planning reminder" },
  { value: "review_reminder", label: "Review reminder" },
];

export default function AdviserInsightsManagerClient() {
  const [mode, setMode] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("financial_education");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalSourceName, setExternalSourceName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInsightsContent() {
      const res = await fetch("/api/advisor/insights", { cache: "no-store" });
      const data = await res.json();

      if (cancelled) return;

      if (res.status === 401 || res.status === 403) {
        setMode("forbidden");
        return;
      }

      if (!res.ok || !data.ok) {
        setMode("error");
        setError(data.error ?? "Failed to load content");
        return;
      }

      setContent(data.content ?? []);
      setMode("ready");
    }

    void loadInsightsContent().catch(() => {
      if (!cancelled) {
        setMode("error");
        setError("Failed to load content");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/advisor/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          body,
          category,
          audienceScope: "assigned_active_clients",
          externalUrl: externalUrl || null,
          externalSourceName: externalSourceName || null,
          expiresAt: expiresAt || null,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to create draft");
        return;
      }

      setShowForm(false);
      setTitle("");
      setSummary("");
      setBody("");
      const reload = await fetch("/api/advisor/insights", { cache: "no-store" });
      const reloadData = await reload.json();
      if (reload.ok && reloadData.ok) {
        setContent(reloadData.content ?? []);
      }
    } catch {
      setError("Failed to create draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(id: string) {
    const res = await fetch(`/api/advisor/insights/${id}/submit`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Submit failed");
      return;
    }
    const reload = await fetch("/api/advisor/insights", { cache: "no-store" });
    const reloadData = await reload.json();
    if (reload.ok && reloadData.ok) {
      setContent(reloadData.content ?? []);
    }
  }

  if (mode === "forbidden") return <AdvisorAccessDenied />;
  if (mode === "loading") return <p className="text-sm text-[#F3F1EA]/50">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#F3F1EA]/50">
          Create governed content for your assigned clients. Content requires admin approval before publication.
        </p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-sm border border-[#D1A866]/30 px-4 py-2 text-xs uppercase tracking-wider text-[#D1A866]"
        >
          {showForm ? "Cancel" : "New draft"}
        </button>
      </div>

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-5">
          <div>
            <label className="text-xs text-[#F3F1EA]/50">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
            />
          </div>
          <div>
            <label className="text-xs text-[#F3F1EA]/50">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              maxLength={400}
              rows={2}
              className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
            />
          </div>
          <div>
            <label className="text-xs text-[#F3F1EA]/50">Body (plain text)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
            />
          </div>
          <div>
            <label className="text-xs text-[#F3F1EA]/50">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-[#F3F1EA]/50">External URL (https)</label>
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                type="url"
                className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
              />
            </div>
            <div>
              <label className="text-xs text-[#F3F1EA]/50">Source name</label>
              <input
                value={externalSourceName}
                onChange={(e) => setExternalSourceName(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#F3F1EA]/50">Expiry / review date</label>
            <input
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              type="date"
              className="mt-1 rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-sm bg-[#D1A866]/20 px-4 py-2 text-xs uppercase tracking-wider text-[#D1A866] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#D1A866]/15 text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {content.map((item) => (
              <tr key={item.id} className="border-b border-[#D1A866]/10">
                <td className="py-3 pr-4 text-[#F3F1EA]">{item.title}</td>
                <td className="py-3 pr-4 text-[#F3F1EA]/50">{item.category}</td>
                <td className="py-3 pr-4">
                  <span className="rounded-sm border border-[#D1A866]/20 px-2 py-0.5 text-[10px] uppercase text-[#F3F1EA]/50">
                    {item.approvalStatus.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-3">
                  {(item.approvalStatus === "draft" || item.approvalStatus === "changes_requested") && (
                    <button
                      type="button"
                      onClick={() => void handleSubmit(item.id)}
                      className="text-xs text-[#D1A866]/80 hover:text-[#D1A866]"
                    >
                      Submit for review
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

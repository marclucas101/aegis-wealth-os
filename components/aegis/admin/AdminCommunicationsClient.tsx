"use client";

import { useEffect, useState } from "react";

type ContentItem = {
  id: string;
  title: string;
  summary: string;
  category: string;
  contentType: string;
  audienceScope: string;
  approvalStatus: string;
  authorUserId: string;
  externalSourceName: string | null;
  expiresAt: string | null;
  version: number;
};

export default function AdminCommunicationsClient() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCommunications() {
      try {
        const res = await fetch("/api/admin/communications", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.ok) {
          setError(data.error ?? "Failed to load");
          return;
        }
        setContent(data.content ?? []);
      } catch {
        if (!cancelled) setError("Failed to load communications");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCommunications();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = content.find((c) => c.id === selectedId);

  async function runAction(action: string) {
    if (!selectedId) return;
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/communications/${selectedId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? `${action} failed`);
        return;
      }

      setReason("");
      const reloadRes = await fetch("/api/admin/communications", { cache: "no-store" });
      const reloadData = await reloadRes.json();
      if (!reloadRes.ok || !reloadData.ok) {
        setError(reloadData.error ?? "Failed to reload");
        return;
      }
      setContent(reloadData.content ?? []);
    } catch {
      setError(`${action} failed`);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-[#F3F1EA]/50">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#F3F1EA]/50">
          Review and approve governed communications. Until a dedicated compliance role exists, admins act as content approvers.
        </p>
        <a
          href="/admin/communications/automation"
          className="text-xs text-[#D1A866] underline underline-offset-2"
        >
          Scheduled publishing operations →
        </a>
        <a
          href="/admin/promotions-migration"
          className="text-xs text-[#D1A866] underline underline-offset-2"
        >
          Legacy promotions migration →
        </a>
      </div>

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#D1A866]/15 text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Category</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`cursor-pointer border-b border-[#D1A866]/10 ${selectedId === item.id ? "bg-[#D1A866]/5" : ""}`}
                >
                  <td className="py-3 pr-4 text-[#F3F1EA]">{item.title}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/50">{item.approvalStatus.replace(/_/g, " ")}</td>
                  <td className="py-3 text-[#F3F1EA]/50">{item.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-5">
            <h3 className="text-lg font-light text-[#F3F1EA]">{selected.title}</h3>
            <p className="mt-2 text-sm text-[#F3F1EA]/60">{selected.summary}</p>
            <dl className="mt-4 space-y-2 text-xs text-[#F3F1EA]/45">
              <div><dt className="inline font-medium">Category: </dt><dd className="inline">{selected.category}</dd></div>
              <div><dt className="inline font-medium">Type: </dt><dd className="inline">{selected.contentType}</dd></div>
              <div><dt className="inline font-medium">Audience: </dt><dd className="inline">{selected.audienceScope}</dd></div>
              <div><dt className="inline font-medium">Version: </dt><dd className="inline">{selected.version}</dd></div>
              {selected.externalSourceName && (
                <div><dt className="inline font-medium">Source: </dt><dd className="inline">{selected.externalSourceName}</dd></div>
              )}
            </dl>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required for reject / request changes)"
              rows={2}
              className="mt-4 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-3 py-2 text-sm text-[#F3F1EA]"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {selected.approvalStatus === "submitted_for_review" && (
                <>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void runAction("approve")}
                    className="rounded-sm bg-[#D1A866]/20 px-3 py-1.5 text-xs text-[#D1A866] disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void runAction("request-changes")}
                    className="rounded-sm border border-[#D1A866]/30 px-3 py-1.5 text-xs text-[#D1A866] disabled:opacity-50"
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void runAction("reject")}
                    className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-300/80 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {selected.approvalStatus === "approved" && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void runAction("publish")}
                  className="rounded-sm bg-[#D1A866]/20 px-3 py-1.5 text-xs text-[#D1A866] disabled:opacity-50"
                >
                  Publish
                </button>
              )}
              {selected.approvalStatus === "scheduled" && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void runAction("publish")}
                  className="rounded-sm bg-[#D1A866]/20 px-3 py-1.5 text-xs text-[#D1A866] disabled:opacity-50"
                >
                  Publish now
                </button>
              )}
              {selected.approvalStatus === "published" && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void runAction("withdraw")}
                  className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-300/80 disabled:opacity-50"
                >
                  Withdraw
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

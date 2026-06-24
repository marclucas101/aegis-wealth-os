"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PROMOTION_MIGRATION_CLASSIFICATIONS } from "@/lib/promotions/promotionMigrationConstants";

type MigrationListItem = {
  id: string;
  title: string;
  createdAt: string;
  publicationStatus: string;
  migrationStatus: string;
  assetStatus: string;
  hasAssets: boolean;
  suggestedClassification: string;
  classification: string | null;
  migratedContentId: string | null;
};

type MigrationDetail = MigrationListItem & {
  summary: string;
  category: string;
  operatorNote: string | null;
  preview: {
    destinationContentType: string;
    destinationCategory: string;
    title: string;
    summary: string;
    bodyPreview: string;
    audienceScope: string;
    initialLifecycleState: string;
    assetStatus: string;
    warnings: string[];
    omittedFields: string[];
    migrationBlocked: boolean;
    blockReason: string | null;
  };
  destination: { id: string; title: string; approvalStatus: string } | null;
  governedContentHref: string | null;
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  safe_educational: "Migrate — safe educational",
  market_update_review: "Migrate — market update",
  event: "Migrate — event",
  product_promotional: "Migrate — product promotional",
  expired: "Retain historical (expired)",
  unsuitable: "Retain / obsolete / manual rewrite",
};

type MigrationRetirementContext = {
  legacyPromotionsRetired: boolean;
  sourceRowCount: number;
  unmigratedQueueCount: number;
  migrationRuntimeAcceptanceComplete: boolean;
  migrationExecutionRestricted: boolean;
  runtimeGateMessage: string;
};

export default function PromotionsMigrationReviewClient() {
  const [items, setItems] = useState<MigrationListItem[]>([]);
  const [retirement, setRetirement] = useState<MigrationRetirementContext | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MigrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<string>("safe_educational");
  const [operatorNote, setOperatorNote] = useState("");
  const [migrationStatus, setMigrationStatus] = useState("unmigrated");
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPromotions() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "20",
          migrationStatus,
        });
        const res = await fetch(`/api/admin/promotions-migration?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.ok) {
          setError(data.error ?? "Failed to load promotions");
          return;
        }
        setItems(data.promotions ?? []);
        setTotalPages(data.totalPages ?? 0);
        if (data.retirement) {
          setRetirement(data.retirement);
        }
      } catch {
        if (!cancelled) setError("Failed to load promotions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPromotions();
    return () => {
      cancelled = true;
    };
  }, [migrationStatus, page]);

  async function loadDetail(promotionId: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promotions-migration/${promotionId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load promotion");
        return;
      }
      setDetail(data.promotion);
      setClassification(
        data.promotion.classification ?? data.promotion.suggestedClassification ?? "unsuitable",
      );
      setOperatorNote(data.promotion.operatorNote ?? "");
    } catch {
      setError("Failed to load promotion");
    } finally {
      setDetailLoading(false);
    }
  }

  function selectPromotion(promotionId: string) {
    setSelectedId(promotionId);
    void loadDetail(promotionId);
  }

  async function refreshPreview(classificationValue: string) {
    if (!selectedId) return;
    const res = await fetch(
      `/api/admin/promotions-migration/${selectedId}/preview?classification=${encodeURIComponent(classificationValue)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    if (res.ok && data.ok && detail) {
      setDetail({ ...detail, preview: data.preview });
    }
  }

  async function saveReview() {
    if (!selectedId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promotions-migration/${selectedId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification, operatorNote }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to save review");
        return;
      }
      await loadDetail(selectedId);
      const listRes = await fetch(
        `/api/admin/promotions-migration?page=${page}&pageSize=20&migrationStatus=${migrationStatus}`,
        { cache: "no-store" },
      );
      const listData = await listRes.json();
      if (listRes.ok && listData.ok) {
        setItems(listData.promotions ?? []);
        setTotalPages(listData.totalPages ?? 0);
      }
    } catch {
      setError("Failed to save review");
    } finally {
      setActionLoading(false);
    }
  }

  async function executeMigrate() {
    if (!selectedId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promotions-migration/${selectedId}/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification, operatorNote }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const message = data.error?.message ?? data.error ?? "Migration failed";
        setError(message);
        return;
      }
      await loadDetail(selectedId);
      const listRes = await fetch(
        `/api/admin/promotions-migration?page=${page}&pageSize=20&migrationStatus=${migrationStatus}`,
        { cache: "no-store" },
      );
      const listData = await listRes.json();
      if (listRes.ok && listData.ok) {
        setItems(listData.promotions ?? []);
        setTotalPages(listData.totalPages ?? 0);
      }
    } catch {
      setError("Migration failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 px-4 py-4 text-sm font-light text-[#F3F1EA]/75">
        <p className="font-normal text-[#F3F1EA]/90">Legacy Promotions is retired.</p>
        <p className="mt-2">
          Production migration queue: {retirement?.unmigratedQueueCount ?? 0}. Historical schema is
          retained during the observation period.
        </p>
        {(retirement?.sourceRowCount ?? 0) === 0 ? (
          <p className="mt-2 text-[#F3F1EA]/55">No legacy promotions require migration.</p>
        ) : null}
        {retirement?.migrationExecutionRestricted &&
        (retirement?.sourceRowCount ?? 0) > 0 ? (
          <p className="mt-3 text-xs text-amber-200/90">{retirement.runtimeGateMessage}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-light text-[#F3F1EA]/50">
          Approved records migrate into Governed Communications as unpublished drafts for normal
          admin review — never auto-published.
        </p>
        <Link
          href="/admin/communications"
          className="text-xs text-[#D1A866] underline underline-offset-2"
        >
          Governed Communications approval →
        </Link>
      </div>

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
          Migration status
          <select
            value={migrationStatus}
            onChange={(e) => {
              setPage(1);
              setMigrationStatus(e.target.value);
            }}
            className="ml-2 rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-2 py-1 text-[10px] text-[#F3F1EA]"
          >
            <option value="unmigrated">Unmigrated</option>
            <option value="migrated">Migrated</option>
            <option value="reviewed_no_destination">Reviewed only</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-sm border border-[#D1A866]/12">
          {loading ? (
            <p className="p-4 text-sm text-[#F3F1EA]/45">Loading…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#D1A866]/15 text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Assets</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer border-b border-[#D1A866]/8 hover:bg-[#10283A]/60 ${
                      selectedId === item.id ? "bg-[#D1A866]/8" : ""
                    }`}
                    onClick={() => selectPromotion(item.id)}
                  >
                    <td className="px-3 py-2 font-light text-[#F3F1EA]">{item.title}</td>
                    <td className="px-3 py-2 text-xs text-[#F3F1EA]/55">{item.migrationStatus}</td>
                    <td className="px-3 py-2 text-xs text-[#F3F1EA]/55">
                      {item.hasAssets ? item.assetStatus : "none"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 text-xs text-[#F3F1EA]/45">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 p-5">
          {!selectedId && (
            <p className="text-sm text-[#F3F1EA]/45">Select a promotion to review.</p>
          )}
          {selectedId && detailLoading && (
            <p className="text-sm text-[#F3F1EA]/45">Loading detail…</p>
          )}
          {detail && !detailLoading && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-light text-[#F3F1EA]">{detail.title}</h2>
                <p className="mt-1 text-xs text-[#F3F1EA]/45">
                  {detail.publicationStatus} · {detail.migrationStatus}
                  {detail.migratedContentId ? ` · destination ${detail.migratedContentId}` : ""}
                </p>
                <p className="mt-3 text-sm font-light text-[#F3F1EA]/65">{detail.summary}</p>
              </div>

              <label className="block space-y-1 text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                Classification
                <select
                  value={classification}
                  disabled={Boolean(detail.migratedContentId)}
                  onChange={(e) => {
                    setClassification(e.target.value);
                    void refreshPreview(e.target.value);
                  }}
                  className="w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-2 py-2 text-sm text-[#F3F1EA]"
                >
                  {PROMOTION_MIGRATION_CLASSIFICATIONS.map((value) => (
                    <option key={value} value={value}>
                      {CLASSIFICATION_LABELS[value] ?? value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                Operator note (optional)
                <textarea
                  value={operatorNote}
                  disabled={Boolean(detail.migratedContentId)}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-2 py-2 text-sm text-[#F3F1EA]"
                />
              </label>

              <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 p-3 text-sm">
                <p className="text-[10px] uppercase tracking-wider text-[#D1A866]/70">
                  Server preview
                </p>
                <p className="mt-2 font-light text-[#F3F1EA]/75">{detail.preview.title}</p>
                <p className="mt-1 text-xs text-[#F3F1EA]/50">{detail.preview.summary}</p>
                <p className="mt-2 whitespace-pre-wrap text-xs text-[#F3F1EA]/55">
                  {detail.preview.bodyPreview}
                </p>
                <p className="mt-2 text-[10px] text-[#F3F1EA]/40">
                  → {detail.preview.destinationCategory} / {detail.preview.initialLifecycleState} /
                  audience {detail.preview.audienceScope}
                </p>
                {detail.preview.migrationBlocked && (
                  <p className="mt-2 text-xs text-amber-200/85">{detail.preview.blockReason}</p>
                )}
                {detail.preview.warnings.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-amber-100/75">
                    {detail.preview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>

              {detail.destination && (
                <p className="text-xs text-[#D1A866]/85">
                  Governed draft: {detail.destination.title} ({detail.destination.approvalStatus}).{" "}
                  <Link href="/admin/communications" className="underline">
                    Open approval workspace
                  </Link>
                </p>
              )}

              {!detail.migratedContentId && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void saveReview()}
                    className="rounded-sm border border-[#F3F1EA]/20 px-4 py-2 text-[10px] uppercase tracking-wider text-[#F3F1EA]/65"
                  >
                    Save review
                  </button>
                  <button
                    type="button"
                    disabled={
                      actionLoading ||
                      detail.preview.migrationBlocked ||
                      retirement?.migrationExecutionRestricted
                    }
                    onClick={() => void executeMigrate()}
                    className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-4 py-2 text-[10px] uppercase tracking-wider text-[#D1A866] disabled:opacity-50"
                  >
                    Migrate to governed draft
                  </button>
                  {retirement?.migrationExecutionRestricted ? (
                    <p className="w-full text-xs text-amber-200/85">
                      {retirement.runtimeGateMessage}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

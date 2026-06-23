"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AdvisorPromotionsListResponse } from "@/app/api/advisor/promotions/route";
import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import PromotionForm, {
  promotionToFormValues,
} from "@/components/aegis/advisor/promotions/PromotionForm";
import PromotionListTable from "@/components/aegis/advisor/promotions/PromotionListTable";
import PromotionPreview from "@/components/aegis/advisor/promotions/PromotionPreview";
import type {
  PromotionRecord,
  PromotionStatus,
} from "@/lib/aegis/promotions";

type ManagerMode = "loading" | "ready" | "error" | "forbidden";
type EditorMode = "list" | "create" | "edit";

type LegacyPromotionsMeta = {
  writeEnabled: boolean;
  readOnlyMessage: string;
  replacementHref: string;
};

export default function PromotionsManagerClient() {
  const [mode, setMode] = useState<ManagerMode>("loading");
  const [editorMode, setEditorMode] = useState<EditorMode>("list");
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [selected, setSelected] = useState<PromotionRecord | null>(null);
  const [sortKey, setSortKey] = useState<"status" | "date" | "priority">("priority");
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [legacyMeta, setLegacyMeta] = useState<LegacyPromotionsMeta>({
    writeEnabled: false,
    readOnlyMessage:
      "Legacy Promotions is now read-only. New client communications should be created through Governed Communications.",
    replacementHref: "/advisor/insights",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPromotions() {
      try {
        const response = await fetch("/api/advisor/promotions", { cache: "no-store" });
        const data = (await response.json()) as AdvisorPromotionsListResponse;

        if (cancelled) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          setMode("forbidden");
          return;
        }

        if (!response.ok || !data.ok) {
          setMode("error");
          setError(data.ok ? "Failed to load promotions" : data.error ?? "Failed to load promotions");
          return;
        }

        setPromotions(data.promotions);
        setLegacyMeta(data.legacyPromotions);
        setMode("ready");
      } catch {
        if (!cancelled) {
          setMode("error");
          setError("Failed to load promotions");
        }
      }
    }

    void loadPromotions();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSaved(promotion: PromotionRecord) {
    setPromotions((current) => {
      const exists = current.some((item) => item.id === promotion.id);
      if (exists) {
        return current.map((item) => (item.id === promotion.id ? promotion : item));
      }
      return [promotion, ...current];
    });
    setSelected(promotion);
    setEditorMode("edit");
  }

  async function handleStatusUpdate(
    promotion: PromotionRecord,
    status: PromotionStatus,
  ) {
    const response = await fetch(`/api/advisor/promotions/${promotion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const data = (await response.json()) as
      | { ok: true; promotion: PromotionRecord }
      | { ok: false; error?: string | { code?: string; message?: string } };

    if (!response.ok || !data.ok) {
      const blocked =
        !data.ok &&
        data.error &&
        typeof data.error === "object" &&
        "code" in data.error &&
        data.error.code === "LEGACY_PROMOTIONS_WRITE_DISABLED";
      setError(
        blocked && typeof data.error === "object"
          ? (data.error.message ?? "Legacy Promotions is read-only.")
          : data.ok
            ? "Failed to update status"
            : typeof data.error === "string"
              ? data.error
              : "Failed to update status",
      );
      return;
    }

    handleSaved(data.promotion);
  }

  if (mode === "forbidden") {
    return <AdvisorAccessDenied />;
  }

  if (mode === "loading") {
    return (
      <div className="h-56 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/40" />
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-500/20 bg-red-500/5 p-6 text-sm font-light text-red-200/80">
        {error ?? "Unable to load promotions manager."}
      </div>
    );
  }

  const readOnly = !legacyMeta.writeEnabled;

  return (
    <div className="space-y-8">
      {readOnly && (
        <div
          className="rounded-sm border border-[#D1A866]/25 bg-[#D1A866]/8 px-5 py-4"
          role="status"
        >
          <p className="text-sm font-light text-[#F3F1EA]/85">{legacyMeta.readOnlyMessage}</p>
          <p className="mt-3 text-xs font-light text-[#F3F1EA]/50">
            Historical promotions remain visible below for reference during migration.
          </p>
          <Link
            href={legacyMeta.replacementHref}
            className="mt-4 inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            Open Governed Communications
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/60">
            Advisor OS
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            {readOnly
              ? "Review historical client opportunities during migration."
              : "Publish concise opportunities for your client book."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/advisor"
            className="inline-flex rounded-sm border border-[#F3F1EA]/15 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/55 transition-colors hover:border-[#F3F1EA]/25 hover:text-[#F3F1EA]/75"
          >
            Back to Advisor OS
          </Link>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setEditorMode("create");
              }}
              className="inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
            >
              New promotion
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm font-light text-amber-100/85">
          {error}
        </div>
      )}

      {editorMode === "list" && (
        <PromotionListTable
          promotions={promotions}
          selectedId={selected?.id ?? null}
          sortKey={sortKey}
          statusFilter={statusFilter}
          readOnly={readOnly}
          onSelect={(promotion) => {
            setSelected(promotion);
            setEditorMode(readOnly ? "edit" : "edit");
          }}
          onSortChange={setSortKey}
          onStatusFilterChange={setStatusFilter}
          onStatusUpdate={(promotion, status) => {
            void handleStatusUpdate(promotion, status);
          }}
        />
      )}

      {(editorMode === "create" || editorMode === "edit") && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-lg font-light text-[#F3F1EA]">
                {editorMode === "create" ? "Create promotion" : "View promotion"}
              </h2>
              <button
                type="button"
                onClick={() => setEditorMode("list")}
                className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/45 hover:text-[#F3F1EA]/70"
              >
                Back to list
              </button>
            </div>

            <PromotionForm
              promotionId={selected?.id}
              initialValues={
                selected ? promotionToFormValues(selected) : undefined
              }
              readOnly={readOnly}
              onSaved={handleSaved}
              onCancel={() => setEditorMode("list")}
            />
          </div>

          {selected && (
            <PromotionPreview promotion={selected} />
          )}
        </div>
      )}
    </div>
  );
}

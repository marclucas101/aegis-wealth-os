"use client";

import {
  isPromotionCurrentlyActive,
  type PromotionRecord,
  type PromotionStatus,
} from "@/lib/aegis/promotions";

type SortKey = "status" | "date" | "priority";

type PromotionListTableProps = {
  promotions: PromotionRecord[];
  selectedId: string | null;
  sortKey: SortKey;
  statusFilter: PromotionStatus | "all";
  readOnly?: boolean;
  onSelect: (promotion: PromotionRecord) => void;
  onSortChange: (sortKey: SortKey) => void;
  onStatusFilterChange: (status: PromotionStatus | "all") => void;
  onStatusUpdate: (promotion: PromotionRecord, status: PromotionStatus) => void;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sortPromotions(
  promotions: PromotionRecord[],
  sortKey: SortKey,
): PromotionRecord[] {
  const copy = [...promotions];

  copy.sort((a, b) => {
    if (sortKey === "priority") {
      return b.priority - a.priority || b.createdAt.localeCompare(a.createdAt);
    }

    if (sortKey === "status") {
      return a.status.localeCompare(b.status) || b.priority - a.priority;
    }

    return b.createdAt.localeCompare(a.createdAt);
  });

  return copy;
}

function statusBadgeClass(status: PromotionStatus, active: boolean): string {
  if (status === "published" && active) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90";
  }

  if (status === "published") {
    return "border-[#D1A866]/35 bg-[#D1A866]/8 text-[#D1A866]/85";
  }

  if (status === "draft") {
    return "border-[#F3F1EA]/15 bg-[#F3F1EA]/5 text-[#F3F1EA]/55";
  }

  return "border-[#F3F1EA]/10 bg-transparent text-[#F3F1EA]/35";
}

export default function PromotionListTable({
  promotions,
  selectedId,
  sortKey,
  statusFilter,
  readOnly = false,
  onSelect,
  onSortChange,
  onStatusFilterChange,
  onStatusUpdate,
}: PromotionListTableProps) {
  const filtered = promotions.filter((promotion) =>
    statusFilter === "all" ? true : promotion.status === statusFilter,
  );
  const sorted = sortPromotions(filtered, sortKey);

  return (
    <section aria-label="Promotion registry" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
          Sort
          <select
            value={sortKey}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-2 py-1.5 text-[10px] text-[#F3F1EA]"
          >
            <option value="priority">Priority</option>
            <option value="date">Date</option>
            <option value="status">Status</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
          Status
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(event.target.value as PromotionStatus | "all")
            }
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-2 py-1.5 text-[10px] text-[#F3F1EA]"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-8 text-sm font-light text-[#F3F1EA]/45">
          No promotions match the current filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-[#D1A866]/12">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#D1A866]/10 bg-[#071B2A]/60 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/35">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">{readOnly ? "View" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((promotion) => {
                const active = isPromotionCurrentlyActive(promotion);
                const isSelected = selectedId === promotion.id;

                return (
                  <tr
                    key={promotion.id}
                    className={`border-b border-[#D1A866]/6 transition-colors ${
                      isSelected ? "bg-[#D1A866]/8" : "hover:bg-[#10283A]/70"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSelect(promotion)}
                        className="text-left font-light text-[#F3F1EA] hover:text-[#D1A866]"
                      >
                        {promotion.title}
                      </button>
                      {promotion.subtitle && (
                        <p className="mt-1 text-xs font-light text-[#F3F1EA]/40">
                          {promotion.subtitle}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-light text-[#F3F1EA]/55">
                      {promotion.category}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-wider ${statusBadgeClass(
                          promotion.status,
                          active,
                        )}`}
                      >
                        {promotion.status === "published" && active
                          ? "Published · Active"
                          : promotion.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#F3F1EA]/65">
                      {promotion.priority}
                    </td>
                    <td className="px-4 py-3 text-xs font-light text-[#F3F1EA]/45">
                      {formatDate(promotion.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {readOnly ? (
                        <button
                          type="button"
                          onClick={() => onSelect(promotion)}
                          className="rounded-sm border border-[#F3F1EA]/15 px-2 py-1 text-[9px] uppercase tracking-wider text-[#F3F1EA]/55 hover:border-[#F3F1EA]/25"
                        >
                          View
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {promotion.status !== "published" && (
                            <button
                              type="button"
                              onClick={() => onStatusUpdate(promotion, "published")}
                              className="rounded-sm border border-[#D1A866]/25 px-2 py-1 text-[9px] uppercase tracking-wider text-[#D1A866]/80 hover:border-[#D1A866]/40"
                            >
                              Publish
                            </button>
                          )}
                          {promotion.status === "published" && (
                            <button
                              type="button"
                              onClick={() => onStatusUpdate(promotion, "draft")}
                              className="rounded-sm border border-[#F3F1EA]/15 px-2 py-1 text-[9px] uppercase tracking-wider text-[#F3F1EA]/55 hover:border-[#F3F1EA]/25"
                            >
                              Unpublish
                            </button>
                          )}
                          {promotion.status !== "archived" && (
                            <button
                              type="button"
                              onClick={() => onStatusUpdate(promotion, "archived")}
                              className="rounded-sm border border-[#F3F1EA]/15 px-2 py-1 text-[9px] uppercase tracking-wider text-[#F3F1EA]/45 hover:border-[#F3F1EA]/25"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

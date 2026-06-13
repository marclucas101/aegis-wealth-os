"use client";

import { useCallback, useEffect, useState } from "react";

import type { AdvisorClientsListResponse } from "@/app/api/advisor/clients/route";
import MyClientsTable from "@/components/aegis/advisor/MyClientsTable";
import type { MyClientsListItem } from "@/lib/aegis/myClients";
import type { ClientStatus } from "@/lib/supabase/userProfile";

const STATUS_OPTIONS: Array<{ value: ClientStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "prospect", label: "Prospect" },
  { value: "review_due", label: "Review due" },
  { value: "archived", label: "Archived" },
];

export default function MyClientsListClient() {
  const [clients, setClients] = useState<MyClientsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (search.trim()) {
        params.set("q", search.trim());
      }
      if (status !== "all") {
        params.set("status", status);
      }

      const response = await fetch(`/api/advisor/clients?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AdvisorClientsListResponse;

      if (!response.ok || !payload.ok) {
        setError(
          payload.ok ? "Failed to load clients" : payload.error ?? "Failed to load clients",
        );
        return;
      }

      setClients(payload.clients);
      setTotalPages(payload.totalPages);
      setTotalCount(payload.totalCount);
    } catch {
      setError("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadClients();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadClients]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadClients();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSearchSubmit}
        className="grid gap-4 rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50 p-4 sm:grid-cols-[1fr_auto_auto]"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            Search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ClientStatus | "all");
              setPage(1);
            }}
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-4 py-2 text-sm text-[#F3F1EA] hover:bg-[#D1A866]/18"
          >
            Search
          </button>
        </div>
      </form>

      <p className="text-xs text-[#F3F1EA]/40">
        Showing {clients.length} of {totalCount} assigned clients
      </p>

      {error && (
        <div className="rounded-sm border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
      ) : (
        <MyClientsTable clients={clients} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-sm border border-[#D1A866]/20 px-3 py-1.5 text-sm text-[#F3F1EA]/70 disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-sm text-[#F3F1EA]/45">
            Page {page} of {totalPages}
          </p>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-sm border border-[#D1A866]/20 px-3 py-1.5 text-sm text-[#F3F1EA]/70 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

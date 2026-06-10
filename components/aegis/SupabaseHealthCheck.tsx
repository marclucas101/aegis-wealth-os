"use client";

import { useCallback, useEffect, useState } from "react";

import type { SupabaseHealthResponse } from "@/app/api/health/supabase/route";

type HealthState =
  | { status: "loading" }
  | { status: "loaded"; data: SupabaseHealthResponse }
  | { status: "error"; message: string };

function StatusRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#D1A866]/8 py-4 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            positive ? "bg-emerald-400/80" : "bg-red-400/80"
          }`}
          aria-hidden
        />
        <span
          className={`text-sm font-light ${
            positive ? "text-emerald-300/90" : "text-red-300/90"
          }`}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

async function requestSupabaseHealth(): Promise<HealthState> {
  try {
    const response = await fetch("/api/health/supabase", {
      cache: "no-store",
    });

    const data = (await response.json()) as SupabaseHealthResponse;
    return { status: "loaded", data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach health endpoint";
    return { status: "error", message };
  }
}

export default function SupabaseHealthCheck() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  const fetchHealth = useCallback(async () => {
    setHealth({ status: "loading" });

    const nextHealth = await requestSupabaseHealth();
    setHealth(nextHealth);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void requestSupabaseHealth().then((nextHealth) => {
      if (!cancelled) {
        setHealth(nextHealth);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = health.status === "loaded" ? health.data : null;
  const connectionOk = loaded?.ok ?? false;

  return (
    <div className="relative max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-8 w-px bg-[#D1A866]/50" />
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/80">
          Phase 3D · Infrastructure
        </p>
      </div>

      <h2 className="text-2xl font-light tracking-wide text-[#F3F1EA]">
        Supabase Health Check
      </h2>
      <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
        Internal connectivity probe for the AEGIS database layer. No
        authentication or client data is accessed beyond a safe schema read.
      </p>

      <div className="mt-8 rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6 backdrop-blur-sm sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-[#F3F1EA]/30">
            Connection Status
          </p>
          <button
            type="button"
            onClick={() => void fetchHealth()}
            className="rounded-sm border border-[#D1A866]/25 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#D1A866]/80 transition-colors hover:border-[#D1A866]/40 hover:text-[#D1A866]"
          >
            Refresh
          </button>
        </div>

        {health.status === "loading" && (
          <p className="text-sm font-light text-[#F3F1EA]/50">Checking…</p>
        )}

        {health.status === "error" && (
          <div className="rounded-sm border border-red-400/20 bg-red-950/20 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-red-300/70">
              Endpoint Error
            </p>
            <p className="mt-2 text-sm font-light text-red-200/80">
              {health.message}
            </p>
          </div>
        )}

        {loaded && (
          <>
            <StatusRow
              label="Supabase Connection"
              value={connectionOk ? "Healthy" : "Unhealthy"}
              positive={connectionOk}
            />
            <StatusRow
              label="Database Reachable"
              value={loaded.databaseReachable ? "Yes" : "No"}
              positive={loaded.databaseReachable}
            />
            <StatusRow
              label="Tables Accessible"
              value={loaded.tablesAccessible ? "Yes" : "No"}
              positive={loaded.tablesAccessible}
            />

            <div className="mt-4 border-t border-[#D1A866]/8 pt-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#F3F1EA]/30">
                Last Checked
              </p>
              <p className="mt-1 font-mono text-xs text-[#F3F1EA]/50">
                {loaded.timestamp}
              </p>
            </div>

            {loaded.error && (
              <div className="mt-4 rounded-sm border border-red-400/20 bg-red-950/20 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-red-300/70">
                  Error
                </p>
                <p className="mt-2 text-sm font-light text-red-200/80">
                  {loaded.error}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
        Internal diagnostic · Not for production client use
      </p>
    </div>
  );
}

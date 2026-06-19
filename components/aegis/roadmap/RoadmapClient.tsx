"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ActiveClientRoadmapView from "@/components/aegis/client/ActiveClientRoadmapView";
import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientSafeFallbackPanel, {
  isClientSafeEnvelopeResponse,
} from "@/components/aegis/client/ClientSafeFallbackPanel";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import type { ClientSafeEnvelope } from "@/lib/compliance/clientSafeDtos";
import type { ClientSafeRoadmapPayload } from "@/lib/compliance/clientRoadmapData";
import RoadmapActionCard from "@/components/aegis/roadmap/RoadmapActionCard";
import RoadmapEmptyState from "@/components/aegis/roadmap/RoadmapEmptyState";
import RoadmapProgressPanel from "@/components/aegis/roadmap/RoadmapProgressPanel";
import RoadmapTimeline from "@/components/aegis/roadmap/RoadmapTimeline";
import {
  applyRoadmapStatuses,
  computeRoadmapFromProfile,
  loadDiscoverProfile,
  loadRoadmapStatuses,
  saveRoadmapStatus,
  type DiscoverStoredProfile,
  type RoadmapItemStatus,
  type RoadmapPageResults,
} from "@/lib/aegis/localProfile";
import type { RoadmapSnapshot } from "@/lib/supabase/moduleQueries";
import { calculateProjectedShield } from "@/src/lib/scoring";

type RoadmapMode = "loading" | "empty" | "cloud" | "local" | "fallback" | "active_client";
type ProfileSource = "cloud" | "local";

function ProfileSourceBadge({ source }: { source: ProfileSource }) {
  const label = source === "cloud" ? "Cloud Profile" : "Local Profile";

  return (
    <span className="inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
      {label}
    </span>
  );
}

function cloudSnapshotToResults(
  snapshot: RoadmapSnapshot,
  statuses: Record<string, RoadmapItemStatus>,
): RoadmapPageResults {
  const roadmap = applyRoadmapStatuses(snapshot.roadmap, statuses);
  const projected = calculateProjectedShield(
    snapshot.shield.pillarScores,
    roadmap,
    snapshot.shield.dataConfidenceFactor,
  );

  return {
    shield: snapshot.shield,
    roadmap,
    projected,
    client: snapshot.client,
    completedAt: snapshot.completedAt,
  };
}

function resolveLocalFallback(): {
  mode: "local" | "empty";
  profile: DiscoverStoredProfile | null;
} {
  const saved = loadDiscoverProfile();
  if (saved) {
    return { mode: "local", profile: saved };
  }
  return { mode: "empty", profile: null };
}

export default function RoadmapClient() {
  const [mode, setMode] = useState<RoadmapMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [cloudSnapshot, setCloudSnapshot] = useState<RoadmapSnapshot | null>(
    null,
  );
  const [fallbackEnvelope, setFallbackEnvelope] =
    useState<ClientSafeEnvelope<unknown> | null>(null);
  const [activeClientRoadmap, setActiveClientRoadmap] =
    useState<ClientSafeRoadmapPayload | null>(null);
  const [statuses, setStatuses] = useState<Record<string, RoadmapItemStatus>>(
    {},
  );
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRoadmap() {
      try {
        const activeResponse = await fetch("/api/client/roadmap", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (activeResponse.ok) {
          const activeData = (await activeResponse.json()) as {
            ok: boolean;
            envelope?: ClientSafeEnvelope<ClientSafeRoadmapPayload | null>;
          };

          if (
            activeData.ok &&
            activeData.envelope &&
            activeData.envelope.accessMode !== "fallback" &&
            activeData.envelope.data
          ) {
            setActiveClientRoadmap(activeData.envelope.data);
            setMode("active_client");
            return;
          }

          if (
            activeData.ok &&
            activeData.envelope &&
            activeData.envelope.accessMode === "fallback"
          ) {
            setFallbackEnvelope(activeData.envelope);
            setMode("fallback");
            return;
          }
        }

        const response = await fetch("/api/roadmap/current", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.status === 401) {
          const fallback = resolveLocalFallback();
          setProfile(fallback.profile);
          setStatuses(loadRoadmapStatuses());
          setMode(fallback.mode);
          return;
        }

        const data = await response.json();

        if (isClientSafeEnvelopeResponse(data)) {
          setFallbackEnvelope(data.envelope);
          setCloudSnapshot(null);
          setProfile(null);
          setMode("fallback");
          return;
        }

        const typed = data as
          | ({ ok: true } & RoadmapSnapshot)
          | { ok: false; reason?: string };

        if (typed.ok && "roadmap" in typed) {
          setCloudSnapshot(typed);
          setProfile(null);
          setStatuses(
            Object.fromEntries(
              typed.roadmap.map((item) => [item.id, item.status]),
            ),
          );
          setMode("cloud");
          return;
        }

        const fallback = resolveLocalFallback();
        setCloudSnapshot(null);
        setProfile(fallback.profile);
        setStatuses(loadRoadmapStatuses());
        setMode(fallback.mode);
      } catch {
        if (cancelled) return;
        const fallback = resolveLocalFallback();
        setCloudSnapshot(null);
        setProfile(fallback.profile);
        setStatuses(loadRoadmapStatuses());
        setMode(fallback.mode);
      }
    }

    void loadRoadmap();

    return () => {
      cancelled = true;
    };
  }, []);

  const localResults: RoadmapPageResults | null = useMemo(() => {
    if (mode !== "local" || !profile) return null;
    return computeRoadmapFromProfile(profile, statuses);
  }, [mode, profile, statuses]);

  const cloudResults: RoadmapPageResults | null = useMemo(() => {
    if (mode !== "cloud" || !cloudSnapshot) return null;
    return cloudSnapshotToResults(cloudSnapshot, statuses);
  }, [mode, cloudSnapshot, statuses]);

  const handleStatusChange = useCallback(
    async (
      id: string,
      status: RoadmapItemStatus,
      previousStatus: RoadmapItemStatus,
    ) => {
      saveRoadmapStatus(id, status);
      setStatuses((current) => ({ ...current, [id]: status }));
      setSaveWarning(null);

      if (mode !== "cloud") {
        return;
      }

      try {
        const response = await fetch("/api/roadmap/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_key: id, status }),
        });

        const data = (await response.json()) as
          | { ok: true; item_key: string; status: RoadmapItemStatus }
          | { ok: false; error?: string };

        if (!response.ok || !data.ok) {
          setStatuses((current) => ({ ...current, [id]: previousStatus }));
          setSaveWarning(
            data.ok === false
              ? (data.error ??
                  "Cloud save unavailable — status saved locally on this device.")
              : "Cloud save unavailable — status saved locally on this device.",
          );
        }
      } catch {
        setStatuses((current) => ({ ...current, [id]: previousStatus }));
        setSaveWarning(
          "Cloud save unavailable — status saved locally on this device.",
        );
      }
    },
    [mode],
  );

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading roadmap…
        </p>
      </div>
    );
  }

  if (mode === "fallback" && fallbackEnvelope) {
    return (
      <div className="flex flex-col gap-6">
        <ClientPortalHeader
          eyebrow="Roadmap"
          title="Agreed actions and progress"
          subtitle="Your adviser will share agreed actions when ready."
        />
        <ClientSafeFallbackPanel title="Roadmap" envelope={fallbackEnvelope} />
        <ClientTrustNotice variant="compact" context="planning" />
      </div>
    );
  }

  if (mode === "active_client" && activeClientRoadmap) {
    return (
      <>
        <ClientPortalHeader
          eyebrow="Roadmap"
          title="Agreed actions and progress"
          subtitle="Client actions and adviser progress — completing a task does not constitute acceptance of advice."
        />
        <ActiveClientRoadmapView roadmap={activeClientRoadmap} />
        <ClientTrustNotice variant="compact" context="planning" />
      </>
    );
  }

  const results = mode === "cloud" ? cloudResults : localResults;

  if (mode === "empty" || !results) {
    return <RoadmapEmptyState />;
  }

  const profileSource: ProfileSource = mode === "cloud" ? "cloud" : "local";
  const footerLabel = mode === "cloud" ? "Cloud Profile" : "Local Profile";

  const completedCount = results.roadmap.filter(
    (item) => item.status === "completed",
  ).length;
  const inProgressCount = results.roadmap.filter(
    (item) => item.status === "in_progress",
  ).length;

  return (
    <>
      <ClientPortalHeader
        eyebrow="Wealth Roadmap"
        title="Your personalised action plan"
        subtitle="Each milestone strengthens a weak pillar. Update status as you progress — your projected Shield score adjusts automatically."
        clientDetail={
          results.client.occupation
            ? `${results.client.occupation} · Age ${results.client.age}`
            : `Age ${results.client.age}`
        }
        netWorth={results.client.netWorth}
        badge={<ProfileSourceBadge source={profileSource} />}
      />

      <div className="flex flex-col gap-6">
        <RoadmapProgressPanel
          shield={results.shield}
          projected={results.projected}
          saveWarning={saveWarning}
        />

        <div className="flex flex-wrap items-center gap-4 rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/30 px-5 py-3">
          <StatPill label="Total milestones" value={String(results.roadmap.length)} />
          <StatPill label="In progress" value={String(inProgressCount)} />
          <StatPill label="Completed" value={String(completedCount)} highlight />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <div className="border-b border-[#D1A866]/10 pb-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
                Your milestones
              </p>
              <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]/55">
                Start at the top — highest impact actions first
              </h3>
            </div>

            {results.roadmap.map((item, index) => (
              <RoadmapActionCard
                key={item.id}
                item={item}
                index={index}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          <RoadmapTimeline items={results.roadmap} />
        </div>

        <ClientTrustNotice variant="compact" context="planning" />
      </div>

      <footer className="mt-10 border-t border-[#D1A866]/10 pt-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
          AEGIS Roadmap™ · {footerLabel} · Captured{" "}
          {new Date(results.completedAt).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </footer>
    </>
  );
}

function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
        {label}
      </span>
      <span
        className={`font-mono text-sm tabular-nums ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]/75"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

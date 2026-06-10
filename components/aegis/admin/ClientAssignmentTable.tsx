"use client";

import { useState } from "react";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type {
  AdminClientRecord,
  AdminUserRecord,
} from "@/lib/supabase/adminManagement";

type SaveState = "idle" | "saving" | "saved" | "error";

function formatAdvisorLabel(advisor: AdminUserRecord): string {
  if (advisor.fullName) {
    return `${advisor.fullName} (${advisor.email})`;
  }

  return advisor.email;
}

function statusLabel(status: AdminClientRecord["status"]): string {
  return status.replace(/_/g, " ");
}

interface ClientAssignmentTableProps {
  clients: AdminClientRecord[];
  advisors: AdminUserRecord[];
  onClientUpdated: (client: AdminClientRecord) => void;
}

export default function ClientAssignmentTable({
  clients,
  advisors,
  onClientUpdated,
}: ClientAssignmentTableProps) {
  const [draftAdvisors, setDraftAdvisors] = useState<
    Record<string, string | null>
  >({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (clients.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-10 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No clients match the current filters.
        </p>
      </div>
    );
  }

  async function handleSave(client: AdminClientRecord) {
    const nextAdvisorId =
      draftAdvisors[client.id] !== undefined
        ? draftAdvisors[client.id]
        : client.advisorUserId;

    if (nextAdvisorId === client.advisorUserId) {
      return;
    }

    setSaveStates((current) => ({ ...current, [client.id]: "saving" }));
    setErrors((current) => {
      const next = { ...current };
      delete next[client.id];
      return next;
    });

    try {
      const response = await fetch(
        `/api/admin/clients/${client.id}/advisor`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ advisor_user_id: nextAdvisorId }),
        },
      );

      const data = (await response.json()) as
        | {
            ok: true;
            clientId: string;
            oldAdvisorUserId: string | null;
            newAdvisorUserId: string | null;
          }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setSaveStates((current) => ({ ...current, [client.id]: "error" }));
        setErrors((current) => ({
          ...current,
          [client.id]: data.ok
            ? "Failed to assign advisor"
            : (data.error ?? "Failed to assign advisor"),
        }));
        return;
      }

      const advisor = data.newAdvisorUserId
        ? advisors.find((entry) => entry.id === data.newAdvisorUserId)
        : undefined;

      onClientUpdated({
        ...client,
        advisorUserId: data.newAdvisorUserId,
        advisorEmail: advisor?.email ?? null,
        advisorFullName: advisor?.fullName ?? null,
      });

      setDraftAdvisors((current) => {
        const next = { ...current };
        delete next[client.id];
        return next;
      });
      setSaveStates((current) => ({ ...current, [client.id]: "saved" }));

      window.setTimeout(() => {
        setSaveStates((current) => {
          if (current[client.id] !== "saved") return current;
          const next = { ...current };
          delete next[client.id];
          return next;
        });
      }, 2000);
    } catch {
      setSaveStates((current) => ({ ...current, [client.id]: "error" }));
      setErrors((current) => ({
        ...current,
        [client.id]: "Failed to assign advisor",
      }));
    }
  }

  return (
    <div className="overflow-hidden rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50">
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[#D1A866]/8 text-left">
              {[
                "Client",
                "Status",
                "Shield",
                "Rating",
                "Advisor",
                "Action",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/35"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D1A866]/8">
            {clients.map((client) => {
              const currentAdvisorId =
                draftAdvisors[client.id] !== undefined
                  ? draftAdvisors[client.id]
                  : client.advisorUserId;
              const isDirty = currentAdvisorId !== client.advisorUserId;
              const saveState = saveStates[client.id] ?? "idle";
              const error = errors[client.id];

              return (
                <tr key={client.id} className="hover:bg-[#071B2A]/30">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-light text-[#F3F1EA]">
                        {client.displayName}
                      </p>
                      {client.email && (
                        <p className="truncate text-xs font-light text-[#F3F1EA]/40">
                          {client.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/55">
                      {statusLabel(client.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-light tabular-nums text-[#D1A866]/90">
                    {client.shieldScore != null
                      ? formatScore(client.shieldScore)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-light text-[#F3F1EA]/70">
                    {client.rating ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={currentAdvisorId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraftAdvisors((current) => ({
                          ...current,
                          [client.id]: value ? value : null,
                        }));
                      }}
                      disabled={saveState === "saving"}
                      className="min-w-[12rem] rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-2 py-1.5 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35 disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {advisors.map((advisor) => (
                        <option key={advisor.id} value={advisor.id}>
                          {formatAdvisorLabel(advisor)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => void handleSave(client)}
                        disabled={!isDirty || saveState === "saving"}
                        className="inline-flex rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saveState === "saving"
                          ? "Saving…"
                          : saveState === "saved"
                            ? "Saved"
                            : "Save"}
                      </button>
                      {error && (
                        <span className="text-xs font-light text-red-300/80">
                          {error}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#D1A866]/8 lg:hidden">
        {clients.map((client) => {
          const currentAdvisorId =
            draftAdvisors[client.id] !== undefined
              ? draftAdvisors[client.id]
              : client.advisorUserId;
          const isDirty = currentAdvisorId !== client.advisorUserId;
          const saveState = saveStates[client.id] ?? "idle";
          const error = errors[client.id];

          return (
            <div key={client.id} className="space-y-3 p-4">
              <div>
                <p className="text-sm font-light text-[#F3F1EA]">
                  {client.displayName}
                </p>
                {client.email && (
                  <p className="text-xs font-light text-[#F3F1EA]/40">
                    {client.email}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-light text-[#F3F1EA]/45">
                <span className="rounded-sm border border-[#D1A866]/15 px-2 py-0.5 uppercase tracking-[0.08em]">
                  {statusLabel(client.status)}
                </span>
                <span>
                  Shield{" "}
                  {client.shieldScore != null
                    ? formatScore(client.shieldScore)
                    : "—"}
                </span>
                <span>Rating {client.rating ?? "—"}</span>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
                  Advisor
                </span>
                <select
                  value={currentAdvisorId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftAdvisors((current) => ({
                      ...current,
                      [client.id]: value ? value : null,
                    }));
                  }}
                  disabled={saveState === "saving"}
                  className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35 disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {formatAdvisorLabel(advisor)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void handleSave(client)}
                disabled={!isDirty || saveState === "saving"}
                className="w-full rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Saved"
                    : "Save assignment"}
              </button>

              {error && (
                <p className="text-xs font-light text-red-300/80">{error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

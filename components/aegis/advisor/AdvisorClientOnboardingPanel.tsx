"use client";

import { useCallback, useEffect, useState } from "react";

import type { OnboardingClientRecord } from "@/lib/supabase/clientOnboarding";

type FormState = "idle" | "submitting" | "success" | "error";
type RowActionState = "idle" | "working" | "success" | "error";

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: OnboardingClientRecord["status"]): string {
  return status.replace(/_/g, " ");
}

interface AdvisorClientOnboardingPanelProps {
  onClientCreated?: () => void;
  defaultExpanded?: boolean;
}

export default function AdvisorClientOnboardingPanel({
  onClientCreated,
  defaultExpanded = true,
}: AdvisorClientOnboardingPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [clients, setClients] = useState<OnboardingClientRecord[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [listError, setListError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [rowStates, setRowStates] = useState<Record<string, RowActionState>>(
    {},
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [manualInvite, setManualInvite] = useState<{
    clientId: string;
    instructions: string;
    signupUrl: string;
  } | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const loadClients = useCallback(async () => {
    setListState("loading");
    setListError(null);

    try {
      const response = await fetch("/api/advisor/client-invitations", {
        cache: "no-store",
      });

      const data = (await response.json()) as
        | { ok: true; clients: OnboardingClientRecord[] }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setListState("error");
        setListError(
          data.ok
            ? "Failed to load onboarding clients"
            : (data.error ?? "Failed to load onboarding clients"),
        );
        return;
      }

      setClients(data.clients);
      setListState("ready");
    } catch {
      setListState("error");
      setListError("Failed to load onboarding clients");
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  async function handleCreateProspective(event: React.FormEvent) {
    event.preventDefault();
    setFormState("submitting");
    setFormError(null);
    setFormSuccess(null);

    try {
      const response = await fetch("/api/advisor/clients/create-placeholder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          email,
          phone: phone.trim() || null,
        }),
      });

      const data = (await response.json()) as
        | {
            ok: true;
            client: OnboardingClientRecord;
            linkedExistingUser: boolean;
          }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setFormState("error");
        setFormError(
          data.ok
            ? "Failed to create prospective client"
            : (data.error ?? "Failed to create prospective client"),
        );
        return;
      }

      setClients((current) => [data.client, ...current]);
      onClientCreated?.();
      setDisplayName("");
      setEmail("");
      setPhone("");
      setFormState("success");
      setFormSuccess(
        data.linkedExistingUser
          ? "Prospective client created and linked to an existing auth account."
          : "Prospective client created and assigned to you.",
      );
    } catch {
      setFormState("error");
      setFormError("Failed to create prospective client");
    }
  }

  async function handleInvite(client: OnboardingClientRecord) {
    if (!client.email) return;

    setRowStates((current) => ({ ...current, [client.id]: "working" }));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[client.id];
      return next;
    });

    try {
      const response = await fetch("/api/advisor/client-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: client.email }),
      });

      const data = (await response.json()) as
        | {
            ok: true;
            method: "email" | "manual";
            clientId: string;
            signupUrl?: string;
            instructions?: string;
          }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setRowStates((current) => ({ ...current, [client.id]: "error" }));
        setRowErrors((current) => ({
          ...current,
          [client.id]: data.ok ? "Invitation failed" : (data.error ?? "Invitation failed"),
        }));
        return;
      }

      if (data.method === "manual" && data.instructions && data.signupUrl) {
        setManualInvite({
          clientId: client.id,
          instructions: data.instructions,
          signupUrl: data.signupUrl,
        });
        setCopyState("idle");
      }

      setClients((current) =>
        current.map((entry) =>
          entry.id === client.id
            ? {
                ...entry,
                hasAuthAccount:
                  data.method === "email" ? true : entry.hasAuthAccount,
              }
            : entry,
        ),
      );
      setRowStates((current) => ({ ...current, [client.id]: "success" }));
    } catch {
      setRowStates((current) => ({ ...current, [client.id]: "error" }));
      setRowErrors((current) => ({
        ...current,
        [client.id]: "Invitation failed",
      }));
    }
  }

  async function handleCopyInstructions() {
    if (!manualInvite) return;

    try {
      await navigator.clipboard.writeText(manualInvite.instructions);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section
      id="advisor-onboarding"
      className="scroll-mt-24 space-y-4"
    >
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Client Onboarding
            </p>
            <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
              Add prospective clients to your mandate and invite them to sign up.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="shrink-0 rounded-sm border border-[#D1A866]/15 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/45 transition-colors hover:border-[#D1A866]/30 hover:text-[#D1A866]"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>

        {expanded ? (
        <>
        <form
          onSubmit={handleCreateProspective}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Display name
            </span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Client name"
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/35"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="client@example.com"
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/35"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Phone (optional)
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+65 …"
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/35"
            />
          </label>

          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={formState === "submitting"}
              className="rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:opacity-50"
            >
              {formState === "submitting"
                ? "Creating…"
                : "Add prospective client"}
            </button>
          </div>
        </form>

        {formError ? (
          <p className="mt-3 text-xs font-light text-red-200/80">{formError}</p>
        ) : null}
        {formSuccess ? (
          <p className="mt-3 text-xs font-light text-[#D1A866]/80">
            {formSuccess}
          </p>
        ) : null}
        </>
        ) : (
          <p className="mt-4 text-xs font-light text-[#F3F1EA]/35">
            Onboarding tools collapsed. Expand to add clients or send invites.
          </p>
        )}
      </div>

      {expanded && manualInvite ? (
        <div className="rounded-sm border border-[#D1A866]/20 bg-[#1A2A2B]/40 p-4 sm:p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Copy invite instructions
          </p>
          <p className="mt-2 text-sm font-light text-[#F3F1EA]/55">
            Email delivery is unavailable. Share these signup instructions with
            your client.
          </p>
          <p className="mt-3 break-all text-xs font-light text-[#D1A866]/70">
            {manualInvite.signupUrl}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopyInstructions()}
              className="rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
            >
              Copy instructions
            </button>
            <button
              type="button"
              onClick={() => setManualInvite(null)}
              className="rounded-sm border border-[#F3F1EA]/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/45 transition-colors hover:text-[#F3F1EA]/70"
            >
              Dismiss
            </button>
          </div>
          {copyState === "copied" ? (
            <p className="mt-2 text-xs font-light text-[#D1A866]/80">
              Instructions copied to clipboard.
            </p>
          ) : null}
          {copyState === "error" ? (
            <p className="mt-2 text-xs font-light text-red-200/80">
              Unable to copy. Select and copy the signup URL manually.
            </p>
          ) : null}
        </div>
      ) : null}

      {expanded && listState === "loading" ? (
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-10 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/45">
            Loading onboarding clients…
          </p>
        </div>
      ) : null}

      {expanded && listState === "error" ? (
        <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-5 py-10 text-center">
          <p className="text-sm font-light text-red-200/80">
            {listError ?? "Failed to load onboarding clients."}
          </p>
        </div>
      ) : null}

      {expanded && listState === "ready" && clients.length === 0 ? (
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-10 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No prospective clients yet. Add one above to begin onboarding.
          </p>
        </div>
      ) : null}

      {expanded && listState === "ready" && clients.length > 0 ? (
        <div className="overflow-x-auto rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40">
          <table className="min-w-full text-left text-sm font-light">
            <thead>
              <tr className="border-b border-[#D1A866]/10 text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Auth</th>
                <th className="px-4 py-3 font-medium">Discover</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const rowState = rowStates[client.id] ?? "idle";
                const rowError = rowErrors[client.id];

                return (
                  <tr
                    key={client.id}
                    className="border-b border-[#D1A866]/8 last:border-b-0"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="text-[#F3F1EA]">{client.displayName}</p>
                      <p className="mt-0.5 text-xs text-[#F3F1EA]/40">
                        {client.email ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top capitalize text-[#F3F1EA]/70">
                      {statusLabel(client.status)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          client.hasAuthAccount
                            ? "text-[#D1A866]/80"
                            : "text-[#F3F1EA]/35"
                        }
                      >
                        {client.hasAuthAccount ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          client.hasCompletedDiscover
                            ? "text-[#D1A866]/80"
                            : "text-[#F3F1EA]/35"
                        }
                      >
                        {client.hasCompletedDiscover ? "Complete" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#F3F1EA]/45">
                      {formatDate(client.lastActivityAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        disabled={
                          rowState === "working" ||
                          !client.email ||
                          client.hasAuthAccount
                        }
                        onClick={() => void handleInvite(client)}
                        className="rounded-sm border border-[#D1A866]/25 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/10 disabled:opacity-40"
                      >
                        {rowState === "working" ? "Working…" : "Invite"}
                      </button>
                      {rowState === "success" ? (
                        <p className="mt-1 text-[10px] text-[#D1A866]/70">
                          Sent
                        </p>
                      ) : null}
                      {rowError ? (
                        <p className="mt-1 text-[10px] text-red-200/80">
                          {rowError}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

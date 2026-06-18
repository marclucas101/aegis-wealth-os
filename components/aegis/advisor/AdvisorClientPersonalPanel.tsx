"use client";

import { useCallback, useState } from "react";

import type { AdvisorClientPersonalResponse } from "@/app/api/advisor/clients/[clientId]/personal/route";

type SaveState = "idle" | "saving" | "saved" | "error";

interface AdvisorClientPersonalPanelProps {
  clientId: string;
  initialDateOfBirth?: string | null;
}

function fieldLabelClass(): string {
  return "text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/70";
}

function fieldInputClass(): string {
  return "mt-2 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition focus:border-[#D1A866]/35";
}

export default function AdvisorClientPersonalPanel({
  clientId,
  initialDateOfBirth = null,
}: AdvisorClientPersonalPanelProps) {
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "");
  const [prevInitial, setPrevInitial] = useState(initialDateOfBirth);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  if (initialDateOfBirth !== prevInitial) {
    setPrevInitial(initialDateOfBirth);
    setDateOfBirth(initialDateOfBirth ?? "");
    setDirty(false);
    setSaveState("idle");
    setSaveError(null);
  }

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    setSaveError(null);

    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/personal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth }),
      });
      const payload = (await response.json()) as AdvisorClientPersonalResponse;

      if (!response.ok || !payload.ok) {
        setSaveError(
          payload.ok ? "Save failed" : payload.error ?? "Save failed",
        );
        setSaveState("error");
        return;
      }

      setDateOfBirth(payload.dateOfBirth ?? "");
      setDirty(false);
      setSaveState("saved");
    } catch {
      setSaveError("Save failed");
      setSaveState("error");
    }
  }, [clientId, dateOfBirth]);

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Personal Details
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Date of birth drives birthday reminder tasks for this client.
        </p>
      </div>

      <div className="relative space-y-4 p-5">
        <label className="block max-w-sm">
          <span className={fieldLabelClass()}>Date of birth</span>
          <input
            type="date"
            value={dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => {
              setDateOfBirth(event.target.value);
              setDirty(true);
              setSaveState("idle");
            }}
            className={fieldInputClass()}
          />
        </label>

        {saveError ? (
          <p className="text-xs font-light text-red-200/75">{saveError}</p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty || saveState === "saving"}
            onClick={() => void handleSave()}
            className="rounded-sm border border-[#D1A866]/25 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[#D1A866]/85 transition hover:border-[#D1A866]/45 disabled:opacity-45"
          >
            {saveState === "saving" ? "Saving…" : "Save personal details"}
          </button>
          {saveState === "saved" ? (
            <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-200/70">
              Saved
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

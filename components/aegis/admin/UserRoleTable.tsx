"use client";

import { useState } from "react";

import type { AdminUserRecord } from "@/lib/supabase/adminManagement";
import type { UserRole } from "@/lib/supabase/userProfile";

const ROLE_OPTIONS: UserRole[] = ["client", "advisor", "admin"];

type SaveState = "idle" | "saving" | "saved" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

interface UserRoleTableProps {
  users: AdminUserRecord[];
  onUserUpdated: (user: AdminUserRecord) => void;
}

export default function UserRoleTable({
  users,
  onUserUpdated,
}: UserRoleTableProps) {
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (users.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-10 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No users match the current filters.
        </p>
      </div>
    );
  }

  async function handleSave(user: AdminUserRecord) {
    const nextRole = draftRoles[user.id] ?? user.role;
    if (nextRole === user.role) {
      return;
    }

    setSaveStates((current) => ({ ...current, [user.id]: "saving" }));
    setErrors((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });

    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      const data = (await response.json()) as
        | { ok: true; user: AdminUserRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setSaveStates((current) => ({ ...current, [user.id]: "error" }));
        setErrors((current) => ({
          ...current,
          [user.id]: data.ok ? "Failed to update role" : (data.error ?? "Failed to update role"),
        }));
        return;
      }

      onUserUpdated(data.user);
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      setSaveStates((current) => ({ ...current, [user.id]: "saved" }));

      window.setTimeout(() => {
        setSaveStates((current) => {
          if (current[user.id] !== "saved") return current;
          const next = { ...current };
          delete next[user.id];
          return next;
        });
      }, 2000);
    } catch {
      setSaveStates((current) => ({ ...current, [user.id]: "error" }));
      setErrors((current) => ({
        ...current,
        [user.id]: "Failed to update role",
      }));
    }
  }

  return (
    <div className="overflow-hidden rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50">
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[#D1A866]/8 text-left">
              {["User", "Role", "Linked clients", "Joined", "Action"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/35"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D1A866]/8">
            {users.map((user) => {
              const currentRole = draftRoles[user.id] ?? user.role;
              const isDirty = currentRole !== user.role;
              const saveState = saveStates[user.id] ?? "idle";
              const error = errors[user.id];

              return (
                <tr key={user.id} className="hover:bg-[#071B2A]/30">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-light text-[#F3F1EA]">
                        {user.fullName ?? user.email}
                      </p>
                      {user.fullName && (
                        <p className="truncate text-xs font-light text-[#F3F1EA]/40">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={currentRole}
                      onChange={(event) =>
                        setDraftRoles((current) => ({
                          ...current,
                          [user.id]: event.target.value as UserRole,
                        }))
                      }
                      disabled={saveState === "saving"}
                      className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-2 py-1.5 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35 disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-light tabular-nums text-[#F3F1EA]/70">
                    {user.linkedClientCount}
                  </td>
                  <td className="px-4 py-3 text-sm font-light text-[#F3F1EA]/50">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => void handleSave(user)}
                        disabled={!isDirty || saveState === "saving"}
                        className="inline-flex rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saveState === "saving"
                          ? "Saving…"
                          : saveState === "saved"
                            ? "Saved"
                            : "Save role"}
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
        {users.map((user) => {
          const currentRole = draftRoles[user.id] ?? user.role;
          const isDirty = currentRole !== user.role;
          const saveState = saveStates[user.id] ?? "idle";
          const error = errors[user.id];

          return (
            <div key={user.id} className="space-y-3 p-4">
              <div>
                <p className="text-sm font-light text-[#F3F1EA]">
                  {user.fullName ?? user.email}
                </p>
                {user.fullName && (
                  <p className="text-xs font-light text-[#F3F1EA]/40">
                    {user.email}
                  </p>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
                  Role
                </span>
                <select
                  value={currentRole}
                  onChange={(event) =>
                    setDraftRoles((current) => ({
                      ...current,
                      [user.id]: event.target.value as UserRole,
                    }))
                  }
                  disabled={saveState === "saving"}
                  className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35 disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center justify-between text-xs font-light text-[#F3F1EA]/40">
                <span>{user.linkedClientCount} linked clients</span>
                <span>Joined {formatDate(user.createdAt)}</span>
              </div>

              <button
                type="button"
                onClick={() => void handleSave(user)}
                disabled={!isDirty || saveState === "saving"}
                className="w-full rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Saved"
                    : "Save role"}
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

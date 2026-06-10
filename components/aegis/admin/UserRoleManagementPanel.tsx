"use client";

import { useMemo, useState } from "react";

import UserRoleTable from "@/components/aegis/admin/UserRoleTable";
import type { AdminUserRecord } from "@/lib/supabase/adminManagement";
import type { UserRole } from "@/lib/supabase/userProfile";

export type UserFilters = {
  search: string;
  role: UserRole | "all";
};

const DEFAULT_FILTERS: UserFilters = {
  search: "",
  role: "all",
};

function matchesSearch(user: AdminUserRecord, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return (
    user.email.toLowerCase().includes(query) ||
    (user.fullName?.toLowerCase().includes(query) ?? false)
  );
}

interface UserRoleManagementPanelProps {
  users: AdminUserRecord[];
  onUserUpdated: (user: AdminUserRecord) => void;
}

export default function UserRoleManagementPanel({
  users,
  onUserUpdated,
}: UserRoleManagementPanelProps) {
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (!matchesSearch(user, filters.search)) return false;
      if (filters.role !== "all" && user.role !== filters.role) return false;
      return true;
    });
  }, [users, filters]);

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              User Role Management
            </p>
            <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
              Showing {filteredUsers.length} of {users.length} users
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Search
            </span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
              placeholder="Email or name"
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/35"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Role
            </span>
            <select
              value={filters.role}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  role: event.target.value as UserFilters["role"],
                })
              }
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35"
            >
              <option value="all">All roles</option>
              <option value="client">Client</option>
              <option value="advisor">Advisor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
      </div>

      <UserRoleTable users={filteredUsers} onUserUpdated={onUserUpdated} />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import ClientAssignmentTable from "@/components/aegis/admin/ClientAssignmentTable";
import type {
  AdminClientRecord,
  AdminUserRecord,
} from "@/lib/supabase/adminManagement";
import type { ClientStatus } from "@/lib/supabase/userProfile";

export type ClientFilters = {
  search: string;
  status: ClientStatus | "all";
  assignment: "all" | "assigned" | "unassigned";
};

const DEFAULT_FILTERS: ClientFilters = {
  search: "",
  status: "all",
  assignment: "all",
};

function matchesSearch(client: AdminClientRecord, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return (
    client.displayName.toLowerCase().includes(query) ||
    (client.email?.toLowerCase().includes(query) ?? false) ||
    (client.advisorEmail?.toLowerCase().includes(query) ?? false) ||
    (client.advisorFullName?.toLowerCase().includes(query) ?? false)
  );
}

interface ClientAssignmentPanelProps {
  clients: AdminClientRecord[];
  users: AdminUserRecord[];
  onClientUpdated: (client: AdminClientRecord) => void;
}

export default function ClientAssignmentPanel({
  clients,
  users,
  onClientUpdated,
}: ClientAssignmentPanelProps) {
  const [filters, setFilters] = useState<ClientFilters>(DEFAULT_FILTERS);

  const assignableAdvisors = useMemo(
    () =>
      users.filter(
        (user) => user.role === "advisor" || user.role === "admin",
      ),
    [users],
  );

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (!matchesSearch(client, filters.search)) return false;
      if (filters.status !== "all" && client.status !== filters.status) {
        return false;
      }
      if (filters.assignment === "assigned" && !client.advisorUserId) {
        return false;
      }
      if (filters.assignment === "unassigned" && client.advisorUserId) {
        return false;
      }
      return true;
    });
  }, [clients, filters]);

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Client Assignment
            </p>
            <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
              Showing {filteredClients.length} of {clients.length} clients
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1.5 lg:col-span-1">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Search
            </span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
              placeholder="Client, email, or advisor"
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/35"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target.value as ClientFilters["status"],
                })
              }
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="prospect">Prospect</option>
              <option value="review_due">Review due</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
              Assignment
            </span>
            <select
              value={filters.assignment}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  assignment: event.target.value as ClientFilters["assignment"],
                })
              }
              className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35"
            >
              <option value="all">All clients</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
        </div>
      </div>

      <ClientAssignmentTable
        clients={filteredClients}
        advisors={assignableAdvisors}
        onClientUpdated={onClientUpdated}
      />
    </div>
  );
}

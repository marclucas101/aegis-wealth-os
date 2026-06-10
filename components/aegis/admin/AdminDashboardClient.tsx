"use client";

import { useEffect, useMemo, useState } from "react";

import AdminMetricCard from "@/components/aegis/admin/AdminMetricCard";
import ClientAssignmentPanel from "@/components/aegis/admin/ClientAssignmentPanel";
import UserRoleManagementPanel from "@/components/aegis/admin/UserRoleManagementPanel";
import type {
  AdminClientRecord,
  AdminUserRecord,
} from "@/lib/supabase/adminManagement";

type AdminMode = "loading" | "ready" | "error";

export default function AdminDashboardClient() {
  const [mode, setMode] = useState<AdminMode>("loading");
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [clients, setClients] = useState<AdminClientRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setMode("loading");
      setErrorMessage(null);

      try {
        const [usersResponse, clientsResponse] = await Promise.all([
          fetch("/api/admin/users", { cache: "no-store" }),
          fetch("/api/admin/clients", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (usersResponse.status === 401 || usersResponse.status === 403) {
          setMode("error");
          setErrorMessage("Admin access required.");
          return;
        }

        if (clientsResponse.status === 401 || clientsResponse.status === 403) {
          setMode("error");
          setErrorMessage("Admin access required.");
          return;
        }

        const usersData = (await usersResponse.json()) as
          | { ok: true; users: AdminUserRecord[] }
          | { ok: false; error?: string };

        const clientsData = (await clientsResponse.json()) as
          | { ok: true; clients: AdminClientRecord[] }
          | { ok: false; error?: string };

        if (!usersData.ok) {
          setMode("error");
          setErrorMessage(usersData.error ?? "Failed to load users.");
          return;
        }

        if (!clientsData.ok) {
          setMode("error");
          setErrorMessage(clientsData.error ?? "Failed to load clients.");
          return;
        }

        setUsers(usersData.users);
        setClients(clientsData.clients);
        setMode("ready");
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load admin console.");
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const adminCount = users.filter((user) => user.role === "admin").length;
    const advisorCount = users.filter((user) => user.role === "advisor").length;
    const assignedClients = clients.filter(
      (client) => client.advisorUserId != null,
    ).length;

    return { adminCount, advisorCount, assignedClients };
  }, [users, clients]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-16 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading admin console…
        </p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-6 py-12 text-center">
        <p className="text-sm font-light text-red-200/80">
          {errorMessage ?? "Unable to load admin console."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Total users" value={users.length} />
        <AdminMetricCard
          label="Advisors"
          value={metrics.advisorCount}
          sublabel={`${metrics.adminCount} administrators`}
        />
        <AdminMetricCard label="Total clients" value={clients.length} />
        <AdminMetricCard
          label="Assigned clients"
          value={metrics.assignedClients}
          highlight
          sublabel={`${clients.length - metrics.assignedClients} unassigned`}
        />
      </div>

      <UserRoleManagementPanel
        users={users}
        onUserUpdated={(updatedUser) => {
          setUsers((current) =>
            current.map((user) =>
              user.id === updatedUser.id ? updatedUser : user,
            ),
          );
        }}
      />

      <ClientAssignmentPanel
        clients={clients}
        users={users}
        onClientUpdated={(updatedClient) => {
          setClients((current) =>
            current.map((client) =>
              client.id === updatedClient.id ? updatedClient : client,
            ),
          );
        }}
      />
    </div>
  );
}

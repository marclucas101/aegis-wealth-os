import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow } from "@/lib/supabase/userProfile";

export type ClientGoalRecord = {
  id: string;
  title: string;
  targetAmount: number | null;
  targetDate: string | null;
  priority: "low" | "medium" | "high";
  status: "active" | "achieved" | "paused" | "archived";
  updatedAt: string;
};

export async function listClientGoals(clientId: string): Promise<ClientGoalRecord[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_goals")
    .select("id, title, target_amount, target_date, priority, status, updated_at")
    .eq("client_id", clientId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load goals: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      title: string;
      target_amount: number | null;
      target_date: string | null;
      priority: string;
      status: string;
      updated_at: string;
    };
    return {
      id: r.id,
      title: r.title,
      targetAmount: r.target_amount,
      targetDate: r.target_date,
      priority: r.priority as ClientGoalRecord["priority"],
      status: r.status as ClientGoalRecord["status"],
      updatedAt: r.updated_at,
    };
  });
}

export async function upsertClientGoal(
  client: AppClientRow,
  input: {
    id?: string;
    title: string;
    targetAmount?: number | null;
    targetDate?: string | null;
    priority?: "low" | "medium" | "high";
  },
): Promise<ClientGoalRecord> {
  const admin = createAdminSupabaseClient();
  const payload = {
    client_id: client.id,
    title: input.title.trim(),
    target_amount: input.targetAmount ?? null,
    target_date: input.targetDate ?? null,
    priority: input.priority ?? "medium",
    status: "active" as const,
  };

  if (input.id) {
    const { data, error } = await admin
      .from("client_goals")
      .update(payload as never)
      .eq("id", input.id)
      .eq("client_id", client.id)
      .select("id, title, target_amount, target_date, priority, status, updated_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to update goal: ${error?.message ?? "not found"}`);
    }

    const r = data as {
      id: string;
      title: string;
      target_amount: number | null;
      target_date: string | null;
      priority: string;
      status: string;
      updated_at: string;
    };

    return {
      id: r.id,
      title: r.title,
      targetAmount: r.target_amount,
      targetDate: r.target_date,
      priority: r.priority as ClientGoalRecord["priority"],
      status: r.status as ClientGoalRecord["status"],
      updatedAt: r.updated_at,
    };
  }

  const { data, error } = await admin
    .from("client_goals")
    .insert(payload as never)
    .select("id, title, target_amount, target_date, priority, status, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create goal: ${error?.message ?? "unknown"}`);
  }

  const r = data as {
    id: string;
    title: string;
    target_amount: number | null;
    target_date: string | null;
    priority: string;
    status: string;
    updated_at: string;
  };

  return {
    id: r.id,
    title: r.title,
    targetAmount: r.target_amount,
    targetDate: r.target_date,
    priority: r.priority as ClientGoalRecord["priority"],
    status: r.status as ClientGoalRecord["status"],
    updatedAt: r.updated_at,
  };
}

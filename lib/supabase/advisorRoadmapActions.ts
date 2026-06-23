import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AdviserRoadmapActionRow = {
  id: string;
  item_key: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  task_owner: "client" | "adviser";
  client_visible: boolean;
  display_category: string | null;
  client_status_label: string | null;
  timeline_months: number;
  priority: "low" | "medium" | "high" | "critical";
  updated_at: string;
};

const ALLOWED_STATUSES = new Set(["not_started", "in_progress", "completed"]);
const ALLOWED_OWNERS = new Set(["client", "adviser"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "critical"]);

export async function listAdviserRoadmapActions(
  clientId: string,
): Promise<AdviserRoadmapActionRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("roadmap_items")
    .select(
      "id, item_key, title, status, task_owner, client_visible, display_category, client_status_label, timeline_months, priority, updated_at",
    )
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load roadmap actions.");
  }

  return (data ?? []) as AdviserRoadmapActionRow[];
}

export async function countClientVisibleRoadmapActions(clientId: string): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from("roadmap_items")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("is_active", true)
    .eq("client_visible", true);

  if (error) {
    throw new Error("Unable to load roadmap actions.");
  }

  return count ?? 0;
}

export type CreateAdviserRoadmapActionInput = {
  title: string;
  description?: string | null;
  taskOwner: "client" | "adviser";
  clientVisible: boolean;
  status?: "not_started" | "in_progress" | "completed";
  timelineMonths?: number;
  priority?: "low" | "medium" | "high" | "critical";
  displayCategory?: string | null;
};

export async function createAdviserRoadmapAction(
  clientId: string,
  input: CreateAdviserRoadmapActionInput,
): Promise<AdviserRoadmapActionRow> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Action title is required.");
  }

  const taskOwner = ALLOWED_OWNERS.has(input.taskOwner) ? input.taskOwner : "client";
  const status = input.status && ALLOWED_STATUSES.has(input.status) ? input.status : "not_started";
  const priority =
    input.priority && ALLOWED_PRIORITIES.has(input.priority) ? input.priority : "medium";
  const timelineMonths =
    typeof input.timelineMonths === "number" && input.timelineMonths > 0
      ? Math.min(120, Math.round(input.timelineMonths))
      : 3;

  const admin = createAdminSupabaseClient();
  const itemKey = `adviser-manual-${randomUUID()}`;
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("roadmap_items")
    .insert({
      client_id: clientId,
      item_key: itemKey,
      is_active: true,
      score_version: "adviser-manual-v1",
      title,
      pillar: "foundation",
      current_score: 0,
      target_score: 80,
      estimated_impact: 0,
      timeline_months: timelineMonths,
      difficulty: "medium",
      priority,
      status,
      task_owner: taskOwner,
      client_visible: input.clientVisible,
      display_category: input.displayCategory?.trim() || input.description?.trim() || null,
      client_status_label:
        taskOwner === "adviser" ? input.description?.trim() || "With your adviser" : null,
      started_at: status === "in_progress" || status === "completed" ? now : null,
      completed_at: status === "completed" ? now : null,
    } as never)
    .select(
      "id, item_key, title, status, task_owner, client_visible, display_category, client_status_label, timeline_months, priority, updated_at",
    )
    .single();

  if (error) {
    throw new Error("Unable to create roadmap action.");
  }

  return data as AdviserRoadmapActionRow;
}

export type UpdateAdviserRoadmapActionInput = {
  title?: string;
  description?: string | null;
  taskOwner?: "client" | "adviser";
  clientVisible?: boolean;
  status?: "not_started" | "in_progress" | "completed";
  timelineMonths?: number;
  priority?: "low" | "medium" | "high" | "critical";
  displayCategory?: string | null;
  archive?: boolean;
};

export async function updateAdviserRoadmapAction(
  clientId: string,
  actionId: string,
  input: UpdateAdviserRoadmapActionInput,
): Promise<AdviserRoadmapActionRow> {
  const admin = createAdminSupabaseClient();
  const { data: existing, error: loadError } = await admin
    .from("roadmap_items")
    .select("id, status, started_at")
    .eq("id", actionId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (loadError || !existing) {
    throw new Error("Roadmap action not found.");
  }

  if (input.archive) {
    const { error } = await admin
      .from("roadmap_items")
      .update({ is_active: false } as never)
      .eq("id", actionId)
      .eq("client_id", clientId);

    if (error) {
      throw new Error("Unable to archive roadmap action.");
    }

    return {
      id: actionId,
      item_key: "",
      title: input.title?.trim() ?? "",
      status: "not_started",
      task_owner: "client",
      client_visible: false,
      display_category: null,
      client_status_label: null,
      timeline_months: 3,
      priority: "medium",
      updated_at: new Date().toISOString(),
    };
  }

  const patch: Record<string, unknown> = {};
  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title) throw new Error("Action title is required.");
    patch.title = title;
  }
  if (input.taskOwner && ALLOWED_OWNERS.has(input.taskOwner)) {
    patch.task_owner = input.taskOwner;
  }
  if (typeof input.clientVisible === "boolean") {
    patch.client_visible = input.clientVisible;
  }
  if (input.status && ALLOWED_STATUSES.has(input.status)) {
    patch.status = input.status;
    const now = new Date().toISOString();
    if (input.status === "in_progress") {
      patch.started_at = (existing as { started_at: string | null }).started_at ?? now;
      patch.completed_at = null;
    } else if (input.status === "completed") {
      patch.completed_at = now;
    } else {
      patch.started_at = null;
      patch.completed_at = null;
    }
  }
  if (typeof input.timelineMonths === "number" && input.timelineMonths > 0) {
    patch.timeline_months = Math.min(120, Math.round(input.timelineMonths));
  }
  if (input.priority && ALLOWED_PRIORITIES.has(input.priority)) {
    patch.priority = input.priority;
  }
  if (input.displayCategory !== undefined) {
    patch.display_category = input.displayCategory?.trim() || null;
  }
  if (input.description !== undefined) {
    const description = input.description?.trim() || null;
    if (patch.task_owner === "adviser" || input.taskOwner === "adviser") {
      patch.client_status_label = description ?? "With your adviser";
    } else {
      patch.display_category = description;
    }
  }

  const { data, error } = await admin
    .from("roadmap_items")
    .update(patch as never)
    .eq("id", actionId)
    .eq("client_id", clientId)
    .select(
      "id, item_key, title, status, task_owner, client_visible, display_category, client_status_label, timeline_months, priority, updated_at",
    )
    .single();

  if (error) {
    throw new Error("Unable to update roadmap action.");
  }

  return data as AdviserRoadmapActionRow;
}

import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow } from "@/lib/supabase/userProfile";

import type { ClientRoadmapDisplayStatus } from "./types";

export type ClientSafeRoadmapTask = {
  id: string;
  title: string;
  category: string | null;
  displayStatus: ClientRoadmapDisplayStatus;
  taskOwner: "client" | "adviser";
  adviserStatusLabel: string | null;
  dueHint: string | null;
  completedAt: string | null;
  /** Explicit disclaimer — task completion is not advice acceptance. */
  completionDisclaimer: string;
};

export type ClientSafeRoadmapPayload = {
  clientActions: ClientSafeRoadmapTask[];
  adviserActions: ClientSafeRoadmapTask[];
  progressPercent: number;
  dataAsAt: string | null;
};

const COMPLETION_DISCLAIMER =
  "Completing a task records your progress only. It does not constitute acceptance of advice or products.";

function mapRoadmapStatus(
  status: string,
  taskOwner: "client" | "adviser",
): ClientRoadmapDisplayStatus {
  if (status === "completed") {
    return "completed";
  }
  if (taskOwner === "adviser") {
    if (status === "in_progress") {
      return "with_your_adviser";
    }
    return "with_your_adviser";
  }
  if (status === "in_progress") {
    return "in_progress";
  }
  return "waiting_on_you";
}

type RoadmapRow = {
  id: string;
  item_key: string;
  title: string;
  status: string;
  task_owner: string | null;
  client_visible: boolean | null;
  client_status_label: string | null;
  display_category: string | null;
  completed_at: string | null;
  updated_at: string;
};

export async function loadClientSafeRoadmap(
  client: AppClientRow,
): Promise<ClientSafeRoadmapPayload> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("roadmap_items")
    .select(
      "id, item_key, title, status, task_owner, client_visible, client_status_label, display_category, completed_at, updated_at",
    )
    .eq("client_id", client.id)
    .eq("is_active", true)
    .eq("client_visible", true)
    .order("priority", { ascending: false });

  if (error) {
    throw new Error(`Failed to load roadmap: ${error.message}`);
  }

  const rows = (data ?? []) as RoadmapRow[];
  const clientActions: ClientSafeRoadmapTask[] = [];
  const adviserActions: ClientSafeRoadmapTask[] = [];

  for (const row of rows) {
    const taskOwner =
      row.task_owner === "adviser" ? ("adviser" as const) : ("client" as const);

    const task: ClientSafeRoadmapTask = {
      id: row.id,
      title: row.title,
      category: row.display_category,
      displayStatus: mapRoadmapStatus(row.status, taskOwner),
      taskOwner,
      adviserStatusLabel:
        taskOwner === "adviser"
          ? row.client_status_label ?? "With your adviser"
          : null,
      dueHint: null,
      completedAt: row.completed_at,
      completionDisclaimer: COMPLETION_DISCLAIMER,
    };

    if (taskOwner === "client") {
      clientActions.push(task);
    } else {
      adviserActions.push(task);
    }
  }

  const total = clientActions.length + adviserActions.length;
  const completed =
    clientActions.filter((t) => t.displayStatus === "completed").length +
    adviserActions.filter((t) => t.displayStatus === "completed").length;
  const progressPercent =
    total > 0 ? Math.round((completed / total) * 100) : 0;

  const latestUpdate = rows.reduce<string | null>((latest, row) => {
    if (!latest || row.updated_at > latest) {
      return row.updated_at;
    }
    return latest;
  }, null);

  return {
    clientActions,
    adviserActions,
    progressPercent,
    dataAsAt: latestUpdate,
  };
}

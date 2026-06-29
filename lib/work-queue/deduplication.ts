import type { AdviserWorkItem, WorkItemReasonCode } from "./types";

export type DeduplicationResult = {
  items: AdviserWorkItem[];
  removedCount: number;
};

function scoreActionability(item: AdviserWorkItem): number {
  let score = 0;
  if (item.blocking) score += 8;
  if (item.state === "actionable") score += 4;
  if (item.state === "blocked") score += 6;
  if (item.timing === "overdue") score += 3;
  if (item.timing === "due_today") score += 2;
  if (item.sourceType === "advisor_task") score += 2;
  return score;
}

function pickWinner(
  current: AdviserWorkItem,
  candidate: AdviserWorkItem,
): AdviserWorkItem {
  const currentScore = scoreActionability(current);
  const candidateScore = scoreActionability(candidate);
  if (candidateScore > currentScore) return candidate;
  if (candidateScore < currentScore) return current;
  return candidate.id < current.id ? candidate : current;
}

function withDedupReason(
  item: AdviserWorkItem,
  relatedIds: string[],
): AdviserWorkItem {
  const reasonCodes: WorkItemReasonCode[] = item.reasonCodes.includes(
    "deduplicated_related_source",
  )
    ? item.reasonCodes
    : [...item.reasonCodes, "deduplicated_related_source"];

  return {
    ...item,
    reasonCodes,
    metadata: {
      ...item.metadata,
      deduplicatedSourceIds: relatedIds,
    },
  };
}

/**
 * Deterministic deduplication across overlapping operational sources.
 * Does not mutate source records.
 */
export function deduplicateWorkItems(items: AdviserWorkItem[]): DeduplicationResult {
  const byId = new Map<string, AdviserWorkItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }

  let working = [...items];
  let removedCount = 0;

  // Rule 1: advisor_task linked to roadmap_item via related_entity
  const taskByRoadmapId = new Map<string, AdviserWorkItem>();
  for (const item of working) {
    if (item.sourceType !== "advisor_task") continue;
    const relatedType = item.metadata.relatedSourceType;
    const relatedId = item.metadata.relatedSourceId;
    if (relatedType === "roadmap_item" && relatedId) {
      taskByRoadmapId.set(relatedId, item);
    }
  }

  const roadmapIdsToDrop = new Set<string>();
  for (const item of working) {
    if (item.sourceType !== "roadmap_item") continue;
    const linkedTask = taskByRoadmapId.get(item.sourceId);
    if (!linkedTask) continue;
    roadmapIdsToDrop.add(item.id);
    const winner = pickWinner(linkedTask, item);
    const loserId = winner.id === linkedTask.id ? item.id : linkedTask.id;
    roadmapIdsToDrop.add(loserId);
    const merged = withDedupReason(winner, [linkedTask.id, item.id]);
    byId.set(merged.id, merged);
  }
  if (roadmapIdsToDrop.size > 0) {
    const before = working.length;
    working = working.filter((item) => !roadmapIdsToDrop.has(item.id));
    removedCount += before - working.length;
    working = working.map((item) => byId.get(item.id) ?? item);
  }

  // Rule 2: appointment + meeting_prep for same appointmentId
  const prepByAppointment = new Map<string, AdviserWorkItem>();
  const apptByAppointment = new Map<string, AdviserWorkItem>();
  for (const item of working) {
    const appointmentId = item.metadata.appointmentId;
    if (!appointmentId) continue;
    if (item.reasonCodes.includes("meeting_prep_missing")) {
      prepByAppointment.set(appointmentId, item);
    }
    if (item.sourceType === "appointment") {
      apptByAppointment.set(appointmentId, item);
    }
  }

  const apptDropIds = new Set<string>();
  for (const [appointmentId, prepItem] of prepByAppointment) {
    const apptItem = apptByAppointment.get(appointmentId);
    if (!apptItem) continue;
    const winner = pickWinner(prepItem, apptItem);
    const loser = winner.id === prepItem.id ? apptItem : prepItem;
    apptDropIds.add(loser.id);
    byId.set(
      winner.id,
      withDedupReason(winner, [prepItem.id, apptItem.id]),
    );
  }
  if (apptDropIds.size > 0) {
    const before = working.length;
    working = working.filter((item) => !apptDropIds.has(item.id));
    removedCount += before - working.length;
    working = working.map((item) => byId.get(item.id) ?? item);
  }

  // Rule 3: review_due + appointment on same client within 3 days
  const reviewByClient = new Map<string, AdviserWorkItem>();
  for (const item of working) {
    if (item.sourceType === "review_due") {
      reviewByClient.set(item.clientId, item);
    }
  }
  const reviewApptDrop = new Set<string>();
  for (const item of working) {
    if (item.sourceType !== "appointment") continue;
    const review = reviewByClient.get(item.clientId);
    if (!review || !review.dueAt || !item.dueAt) continue;
    const reviewTime = new Date(review.dueAt).getTime();
    const apptTime = new Date(item.dueAt).getTime();
    if (Number.isNaN(reviewTime) || Number.isNaN(apptTime)) continue;
    const diffDays = Math.abs(reviewTime - apptTime) / (1000 * 60 * 60 * 24);
    if (diffDays <= 3) {
      const winner = pickWinner(review, item);
      const loser = winner.id === review.id ? item : review;
      reviewApptDrop.add(loser.id);
      byId.set(winner.id, withDedupReason(winner, [review.id, item.id]));
    }
  }
  if (reviewApptDrop.size > 0) {
    const before = working.length;
    working = working.filter((item) => !reviewApptDrop.has(item.id));
    removedCount += before - working.length;
    working = working.map((item) => byId.get(item.id) ?? item);
  }

  // Rule 4: planning_output stale + binder readiness for same client/output type
  const planningByClientType = new Map<string, AdviserWorkItem>();
  for (const item of working) {
    if (item.sourceType !== "planning_output") continue;
    const key = `${item.clientId}:${item.metadata.outputType ?? ""}`;
    planningByClientType.set(key, item);
  }
  const planningDrop = new Set<string>();
  for (const item of working) {
    if (item.sourceType !== "binder_export") continue;
    for (const [key, planning] of planningByClientType) {
      if (!key.startsWith(`${item.clientId}:`)) continue;
      if (!planning.reasonCodes.includes("planning_publish_pending")) continue;
      const winner = pickWinner(planning, item);
      const loser = winner.id === planning.id ? item : planning;
      planningDrop.add(loser.id);
      byId.set(winner.id, withDedupReason(winner, [planning.id, item.id]));
    }
  }
  if (planningDrop.size > 0) {
    const before = working.length;
    working = working.filter((item) => !planningDrop.has(item.id));
    removedCount += before - working.length;
    working = working.map((item) => byId.get(item.id) ?? item);
  }

  // Rule 5: data_completeness duplicate checklistItemId per client
  const completenessSeen = new Map<string, AdviserWorkItem>();
  const completenessDrop = new Set<string>();
  for (const item of working) {
    if (
      item.sourceType !== "data_completeness" &&
      item.sourceType !== "document_follow_up"
    ) {
      continue;
    }
    const checklistItemId = item.metadata.checklistItemId ?? item.sourceId;
    const key = `${item.clientId}:${item.sourceType}:${checklistItemId}`;
    const existing = completenessSeen.get(key);
    if (!existing) {
      completenessSeen.set(key, item);
      continue;
    }
    const winner = pickWinner(existing, item);
    const loser = winner.id === existing.id ? item : existing;
    completenessDrop.add(loser.id);
    completenessSeen.set(key, withDedupReason(winner, [existing.id, item.id]));
  }
  if (completenessDrop.size > 0) {
    const before = working.length;
    working = working.filter((item) => !completenessDrop.has(item.id));
    removedCount += before - working.length;
  }

  return { items: working, removedCount };
}

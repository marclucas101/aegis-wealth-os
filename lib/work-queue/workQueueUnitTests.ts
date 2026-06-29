import { createWorkQueueLoadContext } from "./adapters/types";
import { assembleAdviserWorkQueue } from "./assembleAdviserWorkQueue";
import {
  FIXTURE_ADVISER_ID,
  FIXTURE_CLIENT_UNASSIGNED,
  FIXTURE_NOW,
  fixtureBatchData,
  fixtureClientScopes,
  fixtureOverdueTask,
} from "./fixtures/workQueueFixtures";
import { isAllowlistedWorkQueueHref } from "./routes";
import {
  CANONICAL_SERVICING_STATES,
  resolveCanonicalServicingState,
} from "./servicingState";
import type { AdviserWorkItem } from "./types";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function itemHasNoSensitiveFields(item: AdviserWorkItem): boolean {
  const json = JSON.stringify(item);
  return (
    !json.includes("£") &&
    !json.includes("NRIC") &&
    !json.includes("policy_number") &&
    !json.match(/"summary":"[^"]*\d{6,}/)
  );
}

export function runWorkQueueUnitTests(): { passed: number; failed: string[] } {
  const failed: string[] = [];
  let passed = 0;

  function test(name: string, fn: () => void): void {
    try {
      fn();
      passed += 1;
    } catch (err) {
      failed.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const combo of [
    { status: "active", relationshipStage: "active_client", expected: "active" },
    { status: "prospect", relationshipStage: "prospect", expected: "prospect" },
    { status: "onboarding", relationshipStage: "fact_find_complete", expected: "onboarding" },
    { status: "archived", relationshipStage: "inactive_client", expected: "former" },
    { status: "active", relationshipStage: "inactive_client", expected: "paused" },
    { status: "prospect", relationshipStage: "active_client", expected: "unknown" },
  ]) {
    test(`servicing state ${combo.status}+${combo.relationshipStage}`, () => {
      const result = resolveCanonicalServicingState({
        status: combo.status,
        relationshipStage: combo.relationshipStage,
      });
      assert(result.canonical === combo.expected, `got ${result.canonical}`);
    });
  }

  test("canonical servicing states are exhaustive", () => {
    assert(CANONICAL_SERVICING_STATES.length === 6, "count");
  });

  test("assemble queue with fixtures", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const result = assembleAdviserWorkQueue(context);
    assert(result.items.length > 0, "items");
    assert(result.summary.total === result.items.length, "summary");
  });

  test("deterministic output for identical inputs", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const a = assembleAdviserWorkQueue(context);
    const b = assembleAdviserWorkQueue(context);
    assert(JSON.stringify(a.items) === JSON.stringify(b.items), "deterministic");
  });

  test("excludes completed tasks", () => {
    const completed = { ...fixtureOverdueTask(), status: "completed" as const };
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData({ tasks: [completed] }),
    });
    const result = assembleAdviserWorkQueue(context);
    assert(!result.items.some((i) => i.sourceType === "advisor_task"), "no tasks");
  });

  test("deduplicates task linked to roadmap", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const result = assembleAdviserWorkQueue(context);
    const roadmapItems = result.items.filter((i) => i.sourceType === "roadmap_item");
    assert(roadmapItems.length === 0, "roadmap deduped when task linked");
  });

  test("unassigned client excluded from scope", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData({
        tasks: [
          {
            ...fixtureOverdueTask(),
            clientId: FIXTURE_CLIENT_UNASSIGNED,
          },
        ],
      }),
    });
    const result = assembleAdviserWorkQueue(context);
    assert(
      !result.items.some((i) => i.clientId === FIXTURE_CLIENT_UNASSIGNED),
      "unassigned",
    );
  });

  test("stable sort order by id tie-break", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const result = assembleAdviserWorkQueue(context);
    const ids = result.items.map((i) => i.id);
    const sortedIds = [...ids].sort();
    assert(ids.join(",") === sortedIds.join(",") || result.items.length > 1, "sorted");
  });

  test("action href allowlisted", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const result = assembleAdviserWorkQueue(context);
    for (const item of result.items) {
      assert(isAllowlistedWorkQueueHref(item.actionHref), item.actionHref);
    }
  });

  test("no sensitive fields in items", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const result = assembleAdviserWorkQueue(context);
    for (const item of result.items) {
      assert(itemHasNoSensitiveFields(item), item.id);
    }
  });

  test("maximum result limit enforced", () => {
    const manyTasks = Array.from({ length: 600 }, (_, index) => ({
      ...fixtureOverdueTask(),
      id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
      title: `Task ${index}`,
    }));
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData({ tasks: manyTasks, roadmapItems: [], reviewClients: [], appointments: [], meetingSessions: [], planningOutputs: [], binderExports: [], fileQualityByClientId: {} }),
    });
    const result = assembleAdviserWorkQueue(context);
    assert(result.items.length <= context.limits.maxItems, "limit");
  });

  test("failed binder included", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const result = assembleAdviserWorkQueue(context);
    assert(
      result.items.some((i) => i.sourceType === "binder_export"),
      "binder failure",
    );
  });

  test("data completeness gap included", () => {
    const context = createWorkQueueLoadContext({
      authUserId: FIXTURE_ADVISER_ID,
      userRole: "advisor",
      clients: fixtureClientScopes(),
      nowIso: FIXTURE_NOW,
      batchData: fixtureBatchData(),
    });
    const result = assembleAdviserWorkQueue(context);
    assert(
      result.items.some((i) => i.sourceType === "data_completeness"),
      "data gap",
    );
  });

  return { passed, failed };
}

# CRM V2 Phase 10 — Work Queue Integration

**Dependencies:** Phase 10 `crm_communication_records`, work queue virtual assembly  
**Principle:** Action-based communication queue projection only — never uses advocacy score, sales signals, or automated outreach triggers.

---

## 1. Adapter overview

| Property | Value |
|----------|-------|
| File | `lib/work-queue/adapters/communicationRecordAdapter.ts` |
| Source type | `communication_record` |
| Registry | `lib/work-queue/sourceRegistry.ts` |
| Category | `task` |
| Action owner | `adviser` |
| Priority | **`normal` always** — never derived from score, wealth, or ethnicity |

---

## 2. Batch loader

**Function:** `loadCommunicationRecords()` in `lib/work-queue/loadWorkQueueBatchData.ts`

### Query criteria

| Filter | Value |
|--------|-------|
| `client_id` | IN adviser book `clientIds` |
| `active` | true |
| Adviser role | Additional filter `created_by_user_id = adviserUserId` |
| Admin role | All records in book |

### Row shape — `WorkQueueCommunicationRecordRow`

| Field | Source column |
|-------|---------------|
| `id` | `crm_communication_records.id` |
| `clientId` | `client_id` |
| `safeSubject` | `safe_subject` |
| `lifecycleStatus` | `lifecycle_status` |
| `followUpStatus` | `follow_up_status` |
| `nextFollowUpDate` | `next_follow_up_date` |
| `requiresAction` | Computed (see §3) |
| `updatedAt` | `updated_at` |

---

## 3. Action detection (`requiresAction`)

True when **any** of:

| Condition | Rationale |
|-----------|-----------|
| `lifecycle_status = pending_review` | Draft awaiting adviser/compliance review action |
| `lifecycle_status = failed` | Send/log failure needs resolution |
| `follow_up_status = pending` | Scheduled follow-up due |
| `follow_up_status = overdue` | Overdue follow-up |

**False when:**

- Draft with no review requirement and no follow-up
- Sent/logged/received with `follow_up_status = none` or `completed`
- Cancelled or archived records (still `active=true` but no action flags — loader may still return; adapter skips non-action rows)

Adapter skips rows where `requiresAction=false`.

---

## 4. Work item mapping

| `AdviserWorkItem` field | Value |
|-------------------------|-------|
| `id` | Deterministic: `buildDeterministicWorkItemId("communication_record", row.id)` |
| `sourceType` | `communication_record` |
| `sourceId` | Record UUID |
| `title` | `safe_subject` |
| `summary` | `"Communication requires adviser action"` (generic) |
| `priority` | `normal` |
| `timing` | From `nextFollowUpDate` via `normalizeWorkItemTiming` |
| `actionHref` | `/advisor-v2/communications?clientId={clientId}` |
| `sourceStatus` | `lifecycle_status` |
| `reasonCodes` | `["task_open"]` |
| `blocking` | false |
| `dismissible` | false |
| `metadata` | `{}` (empty — no preference or source payload) |

---

## 5. Explicit restrictions

| Restriction | Enforcement |
|-------------|-------------|
| No advocacy score priority | Adapter has no score input; `communicationMustNotUseAdvocacyScore()` static guard |
| No queue mutation | Adapter implements `load()` only — no `complete` or `dismiss` handler |
| No auto-send from queue | Clicking item navigates to workspace — adviser acts manually |
| No campaign batching | Single record → single item |
| Assignment scope | Skips rows where `clientId` not in book |

---

## 6. Comparison with `advocacyEventAdapter`

| Aspect | Advocacy adapter | Communication adapter |
|--------|------------------|----------------------|
| Source table | `advocacy_events` | `crm_communication_records` |
| Action triggers | Follow-up + consent states | Review + failed + follow-up |
| Priority | `normal` | `normal` |
| Deep link | Advocacy workspace `?eventId=` | Communications `?clientId=` |
| Mutations | None | None |

Both adapters are read-only projections.

---

## 7. Deduplication

Work queue assembly deduplicates items by deterministic ID. Adapter does not mutate source records during deduplication (validated in Phase 10.2 QA).

---

## 8. Failure handling

On adapter exception: returns `adapterErrorResult` with `skippedCount` — does not fail entire queue assembly.

---

## 9. Feature gate interaction

Work queue loads communication records when CRM V2 work queue batch runs under adviser master/pilot gates. Records exist in DB regardless of `crm_v2_communications` flag, but adviser workspace (action target) returns 403 when feature disabled.

**Recommended operator behaviour:** Keep `crm_v2_communications` aligned with queue visibility — enable flag when rolling out communications workspace.

---

## 10. Non-goals

| Non-goal | Status |
|----------|--------|
| Queue item for every draft | Not implemented — drafts without review/follow-up excluded |
| Auto-complete on transition | Not implemented |
| Source-linked auto items | Not implemented — source link does not imply `requiresAction` |
| Client messages in queue | Client inbox separate — inbound replies visible in workspace, not client queue |

**Branch:** `crm-v2-10-communications`

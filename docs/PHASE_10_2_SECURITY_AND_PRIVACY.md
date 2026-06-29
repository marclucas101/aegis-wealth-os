# Phase 10.2 — Security and Privacy

---

## Assignment scope

- Adviser role: only clients with `clients.advisor_user_id = authUserId`
- Tasks also visible via existing adviser task visibility OR filter in batch loader
- Admin role: **deferred** — returns empty queue with `admin_scope_deferred`
- Cross-adviser `clientId` in batch data is skipped when not in scoped client list

---

## DTO minimization

Work items expose:

- Client display name only (no email, phone, financial fields)
- Safe summaries (gap labels, output type names, error codes)
- No Discover JSONB, document filenames, or note bodies

---

## Action link allowlist

`workQueueRoutes` builds hrefs under `/advisor/**` only. Validated by `isAllowlistedWorkQueueHref`.

---

## Logging

- Adapter failures return `adapter_error` warning code without logging source content
- Do not log titles, summaries, or metadata bodies in production paths (10.2 has no production route)

---

## Service-role boundaries

`loadWorkQueueBatchData.ts` uses existing reviewed admin persistence helpers (`createAdminSupabaseClient` pattern per `SERVICE_ROLE_USAGE_REVIEW.md`). Caller-side assignment checks remain mandatory before 10.3 API exposure.

---

## Adapter failure isolation

Each adapter catches errors and returns `adapterErrorResult` — other adapters still contribute items.

---

## Financial data leakage prevention

- No amounts in `AdviserWorkItem` type
- File quality adapter uses checklist labels only
- Binder adapter exposes error code enum only

---

## Feature control

`adviser_work_queue` flag key reserved in `buildAdviserWorkQueue.ts` — **not added to defaults or activated** in 10.2.

---

## Phase 9F.4 / 9F.3

No changes to binder generation behavior or Promotions retirement observation.

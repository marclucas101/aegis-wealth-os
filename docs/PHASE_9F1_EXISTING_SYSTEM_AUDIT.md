# Phase 9F.1 Existing System Audit

Audit date: Phase 9F.1 build. Branch: `phase-9f-production-automation`.

## Purpose

Document the authoritative publication path and related controls that scheduled publishing automation must reuse without weakening Phase 9E governance.

---

## Governed content lifecycle

**Source:** `lib/communications/contentLifecycle.ts`, `lib/communications/types.ts`, `governed_content` table (`202606200006_phase9e_communications_governance.sql`).

| Status | Client visible | Notes |
|--------|----------------|-------|
| `draft`, `submitted_for_review`, `changes_requested`, `rejected` | No | Pre-approval |
| `approved` | No | Awaiting publish or schedule |
| `scheduled` | No | `scheduled_at` stores intent; not visible until published |
| `published` | Yes (if not withdrawn/expired) | `published_at` set |
| `withdrawn`, `expired`, `archived` | No | Terminal / hidden |

Legal transitions are enforced in `assertLegalTransition`. `scheduled → published` is permitted. `isClientVisibleStatus` requires `approval_status === "published"`, no `withdrawn_at`, valid `expires_at`, and `scheduled_at` not in the future.

---

## Authoritative publication workflow

**Primary path:** `lib/communications/contentWorkflow.ts` → `publishContent()`.

**Admin entry point:** `POST /api/admin/communications/[contentId]/publish` (`app/api/admin/communications/[contentId]/publish/route.ts`).

### `publishContent` behaviour

1. Load row; idempotent return if already published.
2. Reject withdrawn content.
3. `assertPublishable` — only `approved` or `scheduled`; requires `approved_by_user_id` when status is `approved`.
4. If `scheduledAt` (or row `scheduled_at`) is in the future → transition to `scheduled` status only (no publication).
5. Otherwise → `dbPublishGovernedContent` with conditional update on `approval_status IN ('approved','scheduled')` and `withdrawn_at IS NULL`.
6. On success, withdraw superseded parent if `supersedes_content_id` set.
7. Write `content_published` audit log.

**Concurrency:** `dbPublishGovernedContent` (`lib/supabase/governedContentPersistence.ts`) uses a conditional UPDATE — returns `null` if state changed concurrently. Caller re-reads and idempotently returns if already published.

### Post-publication delivery (admin route only today)

After `publishContent` returns with `approval_status === "published"`, the admin publish route:

1. Resolves audience targets via `resolvePublishTargets` (inline in route).
2. For each target client: `dbCreateClientNotification` (idempotent on client + type + reference) if `client_in_app_notifications` enabled.
3. `queueInsightEmailDelivery` per client (idempotent on `communication_deliveries` unique index).

**Phase 9F.1 action:** Extract delivery into `lib/communications/publicationDelivery.ts` so automation and admin share one path.

---

## Scheduled status handling (pre-9F.1)

- Admins schedule by calling publish with a future `scheduledAt` → row moves to `scheduled`.
- Comment in `publishContent`: *"Phase 9E: no background scheduler — future scheduled_at stores intent only."*
- Due scheduled content remains invisible until manual admin publish.

---

## Communication delivery

| Layer | File | Idempotency |
|-------|------|-------------|
| In-app notifications | `lib/supabase/clientNotificationsPersistence.ts` | Unique index `idx_client_notifications_idempotent` |
| Email queue | `lib/communications/emailDelivery.ts` | `dbFindDeliveryRecord`; skip if `sent` |
| Delivery ledger | `communication_deliveries` | Unique index `idx_communication_deliveries_idempotent` |
| Email failure | Does not roll back publication | Async after publish commit |

---

## Client notifications

- Table: `client_notifications` — RLS `client_notifications_select_owner` (client reads own only).
- Types include `new_insight` for governed content publication.
- Created server-side only via service role.

---

## Feature controls

**Registry:** `lib/compliance/types.ts` (`PlatformFeatureKey`), defaults in `lib/compliance/featureFlags.ts`, persistence in `platform_feature_controls`.

Relevant Phase 9E keys:

| Key | Default | Gates |
|-----|---------|-------|
| `admin_content_approval` | enabled | Admin approval workspace |
| `insights_and_updates` | enabled | Client feed |
| `market_updates` | enabled | Market update category |
| `product_related_content` | **disabled** | Promotional product type |
| `client_in_app_notifications` | enabled | In-app on publish |
| `client_email_notifications` | enabled | Email on publish |

DB lookup failure: fail-closed via code defaults (`featureFlags.ts` logs warning, uses `FEATURE_DEFAULTS`).

Admin mutation: `setFeatureControl` — admin API only.

**Phase 9F.1 addition:** `scheduled_content_automation` — disabled by default; gates automated runs only. Manual admin publish unaffected.

---

## Audit logging

- `writeAuditLog` (`lib/supabase/auditLog.ts`) — append-only.
- Metadata sanitized via `sanitizeAuditMetadata` (`lib/communications/auditMetadata.ts`) — strips bodies, emails, financial fields.

Publication actions: `content_scheduled`, `content_published`, `notification_created`, `delivery_*`.

---

## Service-role usage

- All `governed_content` writes via `createAdminSupabaseClient()` in persistence layer.
- RLS on governed tables: enabled, **no client/adviser policies** — API-only access.
- Pattern documented in `docs/SERVICE_ROLE_USAGE_REVIEW.md`.

---

## Admin authorization

- `requireAdminAccess()` (`lib/supabase/adminManagement.ts`) — session role must be `admin`.
- Communications routes: approve, reject, publish, withdraw — all use `requireAdminAccess` + `admin_content_approval` feature gate.

---

## Existing internal / automation routes

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/internal/tasks/generate-birthday-reminders` | `CRON_SECRET` via `validateCronSecret` | Birthday reminder tasks |

**Auth mechanism:** `lib/security/cronAuth.ts` — `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` header. No browser session. Returns 401 if secret missing/mismatch.

**Vercel cron:** `vercel.json` schedules birthday reminders at `0 1 * * *`.

**Phase 9F.1:** Add `POST /api/internal/jobs/scheduled-publishing` using same secret pattern (with timing-safe comparison).

---

## Supabase migration conventions

- Timestamp prefix `YYYYMMDDHHMM_description.sql` in `supabase/migrations/`.
- Latest applied remotely: `202606200007_phase9e_hardening.sql`.
- Next additive migration: `202606200008_phase9f_scheduled_publishing.sql`.
- Rollback notes in companion `docs/PHASE_9F1_MIGRATION_AND_ROLLBACK.md`.
- Feature control seeds use `INSERT ... ON CONFLICT DO NOTHING`.

---

## Retry / idempotency helpers

| Mechanism | Location |
|-----------|----------|
| Conditional publish UPDATE | `dbPublishGovernedContent` |
| Notification dedup | `dbCreateClientNotification` pre-check + DB unique index |
| Email dedup | `dbFindDeliveryRecord` + unique delivery index |
| Superseded feed filter | `filterSupersededPublishedRows` |
| Provider error sanitization | `sanitizeProviderError` in `emailDelivery.ts` |
| Audit metadata sanitization | `sanitizeAuditMetadata` |

No existing job-run framework — Phase 9F.1 introduces `lib/jobs/*` and `automation_job_runs` table.

---

## Eligibility dimensions (execution-time recheck required)

Automation must revalidate at run time (not status alone):

1. `approval_status === 'scheduled'`
2. `scheduled_at` not null and `<= now()`
3. `approved_by_user_id` present; author ≠ approver
4. Not withdrawn, archived, or expired
5. Audience scope valid; selected-client assignments valid
6. Category/type permitted; feature controls enabled
7. Market-update source and expiry present when required
8. No published superseding version exists
9. Not already published
10. `scheduled_content_automation` feature enabled

---

## Verdict

**Authoritative publication path for automation:**

```
publishContent()  →  deliverPublicationNotifications()
     ↑                        ↑
contentWorkflow.ts    publicationDelivery.ts (extracted)
dbPublishGovernedContent (conditional)
```

Automation must call this shared path. It must **not** duplicate publication logic or bypass approval, audience, feature-control, or delivery idempotency checks.

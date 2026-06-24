# Phase 9F.4 — Promotion Migration Runbook

## Prerequisites

- Migration `202606200011` applied; `legacy_promotions_write = false`.
- Admin account with `admin_content_approval` enabled.
- Legacy Promotions read-only in production.

## 1. Identify unmigrated records

1. Open `/admin/promotions-migration`.
2. Filter **Migration status → Unmigrated**.
3. Optional filters: publication state (published/archived), active/expired, classification, asset status, adviser.

API equivalent: `GET /api/admin/promotions-migration?migrationStatus=unmigrated&page=1&pageSize=20`

## 2. Review source content

1. Select a promotion from the list.
2. Read sanitized title, summary, publication state, migration status.
3. Review **Server preview** — generated server-side; browser does not author body content.
4. Note asset indicator: `no_asset` vs blocked statuses.

Source promotion remains in `promotions` table unchanged and historically accessible.

## 3. Classify each promotion

| Classification | When to use |
|----------------|-------------|
| `safe_educational` | General education suitable for governed draft |
| `market_update_review` | Market/economic commentary |
| `event` | Event announcements |
| `product_promotional` | Product/offer content suitable for governed channel |
| `expired` | Retain historical only — past end date or archived |
| `unsuitable` | Duplicate, obsolete, manual rewrite, or asset-blocked |

Save review with **Save review** (PATCH) before or instead of migrate.

## 4. When to migrate

Migrate only when:

- Classification is one of the four draft classifications.
- Preview shows `migrationBlocked: false` (no legacy assets in CP3).
- Content is appropriate for Governed Communications after transformation.

Click **Migrate to governed draft** — explicit action only.

## 5. When to retain historical only

Use `expired` or `unsuitable` without migrating. Records `reviewed_no_destination` status. Source promotion untouched.

## 6. When manual rewrite is required

Use `unsuitable`. Create new governed content manually in `/admin/communications` if needed. Do not auto-migrate.

## 7. Asset blocks

If preview shows asset block:

- Do not migrate via this workflow.
- Classify `unsuitable` with note (e.g. "asset manual_review_required").
- Resolve assets outside CP3 scope, or author new governed content manually.

## 8. Retry safely

- Re-posting migrate for an already-migrated promotion returns the same `contentId` (`reused: true`).
- Safe to retry after network errors **only if** no draft was created (check detail for `migratedContentId`).
- If draft exists without linkage (rare upsert failure), find orphan in `/admin/communications` and document promotion ID in operator note.

## 9. Verify governed draft

After migrate:

1. Detail panel shows destination ID and `approval_status: draft`.
2. Open **Governed Communications approval** (`/admin/communications`).
3. Confirm title/summary/body match preview.
4. Confirm not published, not scheduled, no client notification.

## 10. Normal approval workflow

```text
governed draft → admin review → approval → optional scheduling → publication
```

No shortcut from migration page bypasses approval.

## 11. Erroneous destination

- **Do not** alter the source promotion.
- Reject or archive the governed draft through normal communications admin.
- If linkage is wrong, update operator note on review row; do not delete source.
- Orphan drafts: manual cleanup in communications admin only.

## Audit trail

Check audit logs for:

- `legacy_promotion_migration_reviewed`
- `legacy_promotion_migration_started`
- `legacy_promotion_migration_completed`
- `legacy_promotion_migration_reused`
- `legacy_promotion_migration_failed`

Metadata contains IDs and classification only — not bodies or storage paths.

---

## Checkpoint 4 — Application retirement context

Legacy Promotions application paths are retired. This runbook remains valid for **admin migration review** during the 30-day observation period.

| Topic | CP4 posture |
|-------|-------------|
| Admin UI | `/admin/promotions-migration` — **active** |
| List / detail / preview / review | **Active** for authorized admins |
| Migrate POST | **Blocked** until `PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE=true` (staging concurrency acceptance **not completed**) |
| Production `promotions` rows | **0** — queue may show review-only historical records |
| Adviser legacy UI | Redirect to `/advisor/insights` — do not direct advisers to legacy CRUD |
| Client legacy API | Returns `retired: true` — clients should use `/insights` |

**Runtime gate error (migrate):**

```json
HTTP 403
{
  "ok": false,
  "error": {
    "code": "PHASE9F4_MIGRATION_RUNTIME_GATE_INCOMPLETE",
    "message": "Migration execution is restricted until staging concurrency acceptance is completed."
  }
}
```

**Waived for CP4 deploy:** Runtime acceptance is not required to ship application retirement; it is required only before executing migrate POST in any environment.

See also: `docs/PHASE_9F4_OBSERVATION_PLAN.md`, `docs/PHASE_9F4_RELEASE_SIGNOFF.md`.

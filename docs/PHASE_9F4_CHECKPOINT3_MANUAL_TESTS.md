# Phase 9F.4 Checkpoint 3 — Manual Tests

Execute after automated QA passes. Use a **safe test promotion** (no production client data).

## Access control

| # | Step | Expected |
|---|------|----------|
| M1 | Admin opens `/admin/promotions-migration` | Page loads, list visible |
| M2 | Adviser opens same URL | Access denied (admin layout) |
| M3 | Client opens same URL | Access denied |
| M4 | Adviser calls `GET /api/admin/promotions-migration` | 403 |
| M5 | Admin without `admin_content_approval` calls list API | 403 |

## List and filters

| # | Step | Expected |
|---|------|----------|
| M6 | Filter unmigrated | Only unmigrated promotions |
| M7 | Paginate (pageSize=20) | Bounded page, totalPages correct |
| M8 | List item fields | Title, status, asset indicator — no bucket paths or signed URLs |

## Review workflow

| # | Step | Expected |
|---|------|----------|
| M9 | Select unmigrated promotion | Detail + server preview loads |
| M10 | Change classification | Preview refreshes server-side |
| M11 | Save review (unsuitable) | `reviewed_no_destination`, no draft |
| M12 | Operator note with HTML | Tags stripped, length bounded |

## Asset block

| # | Step | Expected |
|---|------|----------|
| M13 | Promotion with `image_url` set | Preview `migrationBlocked: true` |
| M14 | Migrate button | Disabled / 409 on force API call |
| M15 | UI message | Clear asset block explanation |

## Successful migration

| # | Step | Expected |
|---|------|----------|
| M16 | Promotion without assets, `safe_educational` | Migrate succeeds |
| M17 | Governed destination | `approval_status: draft` |
| M18 | Source promotion row | Unchanged (title, body, status, assets) |
| M19 | Retry migrate | Same `contentId`, reused audit |
| M20 | Communications admin | Draft visible for normal approval |

## Negative controls

| # | Step | Expected |
|---|------|----------|
| M21 | POST migrate with forged destination ID in body | Ignored — server creates own |
| M22 | Invalid classification string | 400 |
| M23 | Invalid promotion UUID | 404 |
| M24 | After migrate, PATCH review classification | Rejected (`already_migrated`) |

## Post-migration lifecycle

| # | Step | Expected |
|---|------|----------|
| M25 | Check schedules table | No row for new draft |
| M26 | Check notifications | None emitted by migration |
| M27 | Approve via `/admin/communications` | Normal workflow only |

## Write freeze unchanged

| # | Step | Expected |
|---|------|----------|
| M28 | Adviser POST `/api/advisor/promotions` | `LEGACY_PROMOTIONS_WRITE_DISABLED` |
| M29 | Legacy promotions UI | Read-only banner |

## Sign-off

- [ ] All manual tests passed
- [ ] No source deletion or asset deletion performed
- [ ] No automatic publication or scheduling
- [ ] Remote DB dry-run: up to date (no `202606200012`)

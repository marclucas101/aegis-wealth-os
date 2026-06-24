# Phase 9F.4 — Promotion Asset Observation (Checkpoint 4)

**Checkpoint:** 9F.4 Checkpoint 4  
**Policy:** Retain `promotion-assets` storage bucket — **no deletion** during application retirement or the 30-day observation window

---

## Scope

Legacy promotion files live in the private Supabase storage bucket `promotion-assets` (constant `PROMOTION_BUCKET` in `lib/supabase/promotionsPersistence.ts`). Checkpoint 3 asset policy blocks automatic migration when `image_url` or `attachment_url` is present. Checkpoint 4 does not copy, move, or delete bucket objects.

---

## Current production posture

| Artifact | CP4 state |
|----------|-----------|
| Bucket `promotion-assets` | **Retained** |
| Bucket RLS / privacy | Private; signed URLs via service role (300s expiry) |
| Automatic asset copy to governed storage | **Not implemented** |
| Production `promotions` rows | **0** — object count may still be non-zero from historical uploads |

---

## Why assets are retained

1. **Audit and compliance** — Historical files may be referenced in audit logs or operator notes.
2. **Option B reversibility** — Application rollback does not require storage restore if objects were never deleted.
3. **Incomplete automatic migration** — Asset-blocked promotions require manual disposition (`docs/PHASE_9F4_ASSET_MIGRATION_POLICY.md`).
4. **Observation evidence** — Operators verify no orphaned-object incidents before optional archive.

---

## Asset status classifications (reference)

From `lib/promotions/promotionAssetPolicy.ts`:

| Status | Migration allowed at CP3/CP4 |
|--------|------------------------------|
| `no_asset` | Yes (subject to classification) |
| `manual_review_required` | No |
| `unsupported` | No |
| `copy_required` | No (reserved) |
| `existing_governed_reference` | No (reserved) |

Retired adviser upload API returns **410** — no new objects should be created during observation.

---

## Observation activities

### At observation start (Day 0)

1. Record bucket existence via preflight diagnostic (`promotion_assets_bucket_exists`).
2. Capture approximate object count (Supabase dashboard or `storage.objects` query — operator only).
3. Correlate with `promotions` rows referencing `image_url` / `attachment_url` (production count **0** implies paths exist only in historical audit or orphaned objects).

### During observation (weekly)

| Check | Pass criteria |
|-------|---------------|
| Bucket still present | `promotion-assets` exists |
| No deletion jobs | No operator or automated purge |
| No new uploads | No successful upload audit; upload API returns 410 |
| Signed URL generation | Only from admin migration read paths if any legacy row reintroduced in non-prod |

### Preflight diagnostic

Run `supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql`:

- Validates `promotion_assets_bucket_exists`
- Reports WARNING if bucket missing (should not occur under Option B)

---

## Relationship to admin migration review

During observation, admins may:

- **List and classify** historical promotions (including asset indicators in UI)
- **Save review** without migrating asset-blocked rows
- **Not execute migrate POST** until runtime concurrency acceptance completes (and only when rows exist)

Asset-blocked rows should be classified `unsuitable` with operator notes per runbook — no automatic deletion of source files.

---

## Future disposition (post-observation — not CP4)

Optional paths after observation exit criteria met:

| Option | Requires |
|--------|----------|
| Secure copy to governed asset store | Future helper meeting policy preconditions in `docs/PHASE_9F4_ASSET_MIGRATION_POLICY.md` |
| Archive to cold storage | Operator approval + inventory |
| Bucket deletion | **Explicit Stage 6 checkpoint** + proof no business or audit dependency |

**Checkpoint 4 explicitly forbids bucket deletion.**

**UI telemetry policy:** Do not expose object names or paths in UI telemetry, admin banners, or client-facing error messages.

---

## Incident response

| Event | Response |
|-------|----------|
| Accidental object delete | Restore from Supabase backup; document in observation log |
| Public URL exposure | Rotate keys; verify private bucket policy unchanged |
| Orphan objects (no parent row) | Inventory only during observation; defer purge to Stage 6 decision |

---

## Sign-off

Asset observation completes when:

1. 30-day window ends
2. Bucket inventory documented
3. No open asset-blocked migration reviews requiring file access
4. Operator approves or defers Stage 6 storage action in release sign-off

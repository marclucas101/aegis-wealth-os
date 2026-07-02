# CRM V2 Phase 07 — Migration Runbook

## Migrations (do not auto-apply)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/202606290010_phase07_crm_v2_protection_feature_control.sql` | Seed `crm_v2_protection_portfolio` (default disabled) |
| 2 | `supabase/migrations/202606290011_phase07_crm_v2_protection_core.sql` | Protection tables, RLS, service request category extension |

**Status:** Created in repository — **not applied** without operator Gate G8 approval.

**Prerequisite:** Phase 06 migrations `202606290008`, `202606290009` applied (`client_service_requests` must exist for category ALTER).

---

## Diagnostics

### Feature control (`202606290010`)

- `supabase/diagnostics/preflight_202606290010_phase07_crm_v2_protection_feature_control.sql`
- `supabase/diagnostics/verify_202606290010_phase07_crm_v2_protection_feature_control.sql`
- `supabase/diagnostics/verify_202606290010_phase07_crm_v2_protection_feature_control_discrepancies.sql`

### Protection core (`202606290011`)

- `supabase/diagnostics/preflight_202606290011_phase07_crm_v2_protection_core.sql`
- `supabase/diagnostics/verify_202606290011_phase07_crm_v2_protection_core.sql`
- `supabase/diagnostics/verify_202606290011_phase07_crm_v2_protection_core_discrepancies.sql`

---

## Apply order

1. Confirm Phase 06 applied and verified.
2. Run `npx supabase db push --dry-run` — expect **only** Phase 07 migrations pending (after any earlier pending gates cleared).
3. Execute preflight for `202606290010`.
4. Apply migration `202606290010`.
5. Run verify + discrepancy diagnostics for `202606290010`.
6. Confirm row exists: `feature_key = 'crm_v2_protection_portfolio'`, `enabled = false`, `client_visible = true`, `adviser_visible = true`.
7. Execute preflight for `202606290011`.
8. Apply migration `202606290011`.
9. Run verify + discrepancy diagnostics for `202606290011`.
10. Confirm four protection tables exist with RLS enabled.
11. Confirm `client_service_requests` CHECK includes `protection_correction`, `protection_review`.
12. Enable `crm_v2_protection_portfolio` via operator API/SQL only after staging QA.

---

## Schema summary (`202606290010`)

**Changes:**

- `INSERT INTO platform_feature_controls` single row
- `ON CONFLICT (feature_key) DO NOTHING`
- `enabled = false` — fail closed

**No table DDL.**

---

## Schema summary (`202606290011`)

### Tables created

| Table | Purpose |
|-------|---------|
| `protection_policies` | Policy identity + current version pointer |
| `protection_policy_versions` | Versioned coverage/premium payload |
| `protection_extractions` | Provisional extraction review |
| `protection_domain_events` | Immutable audit events |

### ALTER existing

- `client_service_requests` — drop/recreate `request_category` CHECK to add protection categories

### Indexes

| Index | Table | Purpose |
|-------|-------|---------|
| `idx_protection_policies_client` | policies | Client portfolio list (non-archived) |
| `idx_protection_policies_adviser` | policies | Adviser book |
| `idx_protection_policies_source_document` | policies | Vault FK lookup |
| `idx_protection_policy_versions_policy` | versions | History by policy |
| `idx_protection_policy_versions_confirmed` | versions | Confirmed versions partial |
| `idx_protection_extractions_idempotency` | extractions | Unique partial on `(client_id, idempotency_key)` |
| `idx_protection_extractions_client_review` | extractions | Client review queue |
| `idx_protection_extractions_adviser_review` | extractions | Adviser open reviews partial |
| `idx_protection_domain_events_client` | events | Client timeline |
| `idx_protection_domain_events_entity` | events | Entity audit |

### Constraints

- Category/status/premium frequency CHECK enums
- `protection_policy_versions_unique_number` UNIQUE `(policy_id, version_number)`
- FK `protection_policies.current_confirmed_version_id` → versions
- FK `protection_policy_versions.source_extraction_id` → extractions
- Char length limits on text fields

### RLS

Enabled on all four tables. Policy `protection_*_assignment` with `DROP POLICY IF EXISTS` guards.

### Triggers

`set_updated_at` on policies, versions, extractions — `DROP TRIGGER IF EXISTS` before create.

### Comments

SQL `COMMENT ON TABLE` documents client visibility rules.

---

## Safety notes

- Additive only — no DROP of legacy tables
- No `CREATE TABLE documents` — vault unchanged
- No data backfill from historical PDFs
- No feature activation in SQL (`enabled = false`)
- No `advisor_work_items` table
- Rerunnable DDL patterns (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`)
- Rollback tier 1: disable feature flag
- Rollback tier 2: retain schema — no destructive DROP in pilot

---

## Verification queries (operator)

```sql
-- Feature row
SELECT feature_key, enabled, client_visible, adviser_visible
FROM platform_feature_controls
WHERE feature_key = 'crm_v2_protection_portfolio';

-- Tables exist
SELECT tablename FROM pg_tables
WHERE tablename LIKE 'protection_%';

-- RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname LIKE 'protection_%';

-- Service categories
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'client_service_requests'::regclass
  AND conname LIKE '%category%';
```

---

## Enable sequence (post-apply)

1. Staging: enable `crm_v2_protection_portfolio` for pilot adviser only (pilot allowlist unchanged).
2. Run manual test checklist `docs/CRM_V2_PHASE_07_MANUAL_TESTS.md`.
3. Run `npm run qa:crm-v2-protection`.
4. Run IDOR suite `docs/CRM_V2_PHASE_07_SECURITY_REVIEW.md` §5.
5. Production: operator Gate G8 sign-off required.

**Client visibility:** requires `client_visible = true` on same feature row — no second flag.

**Client corrections:** requires `crm_v2_client_service` enabled separately.

---

## Rollback

| Tier | Action |
|------|--------|
| Feature off | `UPDATE platform_feature_controls SET enabled = false WHERE feature_key = 'crm_v2_protection_portfolio'` |
| Full V2 off | `crm_v2_master = false` |
| Schema | Retain tables; no destructive rollback in pilot |

---

## Operator gate

**Gate G8** — Protection portfolio apply per `docs/CRM_V2_FEATURE_CONTROL_PLAN.md`

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|--------------|------------|
| `202606290011` fails on `client_service_requests` CHECK | Phase 06 not applied | Apply `202606290009` first |
| FK error on `source_document_id` | Invalid document UUID in test data | Use real vault document or NULL |
| RLS denies adviser insert in manual SQL | Using client JWT not adviser | Test via API with assignment or use service role in controlled ops |
| Feature row missing after `202606290010` | Conflict swallowed | `SELECT` feature row; re-run if absent |
| Duplicate index on re-apply | Expected with `IF NOT EXISTS` | Safe — verify diagnostics not raw `\d` only |
| Work queue errors pre-migration | Tables missing | Expected before `202606290011`; adapters try/catch |

---

## Post-apply application deploy

1. Deploy application build containing Phase 07 routes and `lib/crm-v2/protection/*`.
2. Do **not** enable feature in same deploy step as migration.
3. Run `npm run qa:crm-v2-protection` against staging API.
4. Smoke test adviser portfolio route returns 403 until enable (expected).
5. Enable feature for pilot; smoke test 200 on portfolio GET.

---

## Dependency chain

```text
Phase 06 service core (202606290009)
  └── client_service_requests table
        └── Phase 07 core (202606290011) ALTER category CHECK
              └── protection_* tables
                    └── Application Phase 07 code + feature seed (202606290010)
```

Phase 07 feature control migration (`202606290010`) has no FK dependency on Phase 07 core and may be applied first, but operator should apply both before enabling feature.

---

## Cross-references

- Architecture: `docs/CRM_V2_PHASE_07_PROTECTION_ARCHITECTURE.md`
- Completion: `docs/CRM_V2_PHASE_07_COMPLETION.md`
- Migration sequence: `docs/CRM_V2_MIGRATION_SEQUENCE.md` M05

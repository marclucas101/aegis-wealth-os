# CRM V2 Phase 10 — Migration Runbook

## Migrations (do not auto-apply)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/202606290016_phase10_crm_v2_communications_feature_control.sql` | Seed `crm_v2_communications` (default disabled, `client_visible=true`, `adviser_visible=true`) |
| 2 | `supabase/migrations/202606290017_phase10_crm_v2_communications_core.sql` | Communication tables, preference extensions, template seeds, RLS, triggers |

**Branch:** `crm-v2-10-communications`  
**Status:** Created in repository — **not applied** without operator approval.

**Prerequisites:**

- `clients`, `users` tables (FK targets)
- `governed_content` (Phase 9E) for optional `governed_content_id` FK
- `communication_preferences` (Phase 9E) for ALTER extensions
- `set_updated_at()` function (existing platform)
- Phase 09 advocacy core applied (no hard dependency; coexistence verified)

---

## Diagnostics

### Feature control (`202606290016`)

- `supabase/diagnostics/preflight_202606290016_phase10_crm_v2_communications_feature_control.sql`
- `supabase/diagnostics/verify_202606290016_phase10_crm_v2_communications_feature_control.sql`
- `supabase/diagnostics/verify_202606290016_phase10_crm_v2_communications_feature_control_discrepancies.sql`

### Core (`202606290017`)

- `supabase/diagnostics/preflight_202606290017_phase10_crm_v2_communications_core.sql`
- `supabase/diagnostics/verify_202606290017_phase10_crm_v2_communications_core.sql`
- `supabase/diagnostics/verify_202606290017_phase10_crm_v2_communications_core_discrepancies.sql`

---

## Apply order

1. Confirm Phase 9E `communication_preferences` and `governed_content` exist on target database.
2. Run `npx supabase db push --dry-run` — expect Phase 10 migrations pending.
3. Execute preflight for `202606290016`.
4. Apply migration `202606290016`.
5. Run verify + discrepancy diagnostics for `202606290016`.
6. Confirm row exists:
   - `crm_v2_communications`: `enabled = false`, `client_visible = true`, `adviser_visible = true`
7. Execute preflight for `202606290017`.
8. Apply migration `202606290017`.
9. Run verify + discrepancy diagnostics for `202606290017`.
10. Confirm tables: `crm_communication_threads`, `crm_communication_records`, `crm_communication_templates`, `crm_communication_domain_events`.
11. Confirm `communication_preferences` new columns: `preferred_channel`, `do_not_contact`, `festive_acknowledgement_opt_out`, `client_message_visibility`, `last_confirmed_at`, `version`.
12. Confirm template seeds (3 rows) with `compliance_status=approved`.
13. Confirm indexes: idempotency, adviser_status, client_visible, follow_up, thread, domain_events.
14. Confirm RLS enabled on all four new tables.
15. Confirm triggers: `crm_communication_*_set_updated_at` on threads, records, templates.
16. Enable `crm_v2_communications` via operator API/SQL only after staging QA.

---

## Schema summary (`202606290016`)

**Changes:**

- `INSERT INTO platform_feature_controls` one row for `crm_v2_communications`
- `ON CONFLICT (feature_key) DO NOTHING`
- `enabled = false` — fail closed

**No table DDL.**

---

## Schema summary (`202606290017`)

### Tables created

| Table | Purpose |
|-------|---------|
| `crm_communication_templates` | Versioned governed templates |
| `crm_communication_threads` | Client/source communication grouping |
| `crm_communication_records` | Drafts, logs, client-visible messages |
| `crm_communication_domain_events` | Immutable domain audit log |

### Tables altered

| Table | Changes |
|-------|---------|
| `communication_preferences` | Phase 10 consent/channel columns + CHECK constraints |

### Notable constraints

- No Promotions Stage 6 DROP
- No campaign automation or external send schema
- `channelAllowsAutoSend` not represented in DB — application enforced
- CHECK constraints on channels, lifecycle, source types, compliance status
- Unique idempotency index on `(client_id, idempotency_key)` where active

### RLS

| Table | Access |
|-------|--------|
| `crm_communication_threads` | Assignment-scoped ALL |
| `crm_communication_records` | Assignment ALL + client SELECT visible delivered |
| `crm_communication_templates` | SELECT advisers/admins |
| `crm_communication_domain_events` | SELECT assignment/admin |

---

## Rollback

| Level | Action |
|-------|--------|
| Feature | Set `crm_v2_communications.enabled = false` |
| Application | Disable flag stops new writes; APIs return 403 |
| Schema | **Retain** tables — no DROP on rollback |
| Data | Records preserved for audit |
| Preferences extension | Columns remain — harmless defaults |

---

## Post-apply verification queries

```sql
-- Feature seed
SELECT feature_key, enabled, client_visible, adviser_visible
FROM platform_feature_controls
WHERE feature_key = 'crm_v2_communications';

-- Template seeds
SELECT template_key, version, compliance_status, active
FROM crm_communication_templates
ORDER BY template_key;

-- Preference extensions
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'communication_preferences'
  AND column_name IN (
    'preferred_channel', 'do_not_contact', 'festive_acknowledgement_opt_out',
    'client_message_visibility', 'last_confirmed_at', 'version'
  );

-- RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'crm_communication_threads',
    'crm_communication_records',
    'crm_communication_templates',
    'crm_communication_domain_events'
  );

-- Confirm no Promotions DROP in Phase 10 migrations (grep verification)
-- Expect: zero DROP TABLE promotions in 202606290016 and 202606290017
```

---

## Operator sign-off

| Step | Owner | Date | Pass |
|------|-------|------|------|
| Dry-run reviewed | | | |
| Preflight 016 | | | |
| Apply 016 | | | |
| Verify 016 | | | |
| Preflight 017 | | | |
| Apply 017 | | | |
| Verify 017 | | | |
| Manual tests (47) | | | |
| Feature enable (staging) | | | |

**Migrations status:** NOT APPLIED (as of documentation delivery)

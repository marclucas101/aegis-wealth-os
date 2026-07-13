# CRM V2 Phase 07 — Policy Versioning

**Tables:** `protection_policies`, `protection_policy_versions`  
**Module:** `lib/crm-v2/protection/protection.ts`, `lib/crm-v2/protection/deduplication.ts`

---

## 1. Version model overview

Phase 07 separates **policy identity** from **versioned financial/coverage payload**:

```text
protection_policies (1) ──< (N) protection_policy_versions
         │
         └── current_confirmed_version_id → single pointer to active confirmed/corrected version
```

- Identity fields on `protection_policies` update on confirm to reflect latest adviser-approved header.
- Historical versions remain queryable; superseded versions retain full `structured_snapshot`.

---

## 2. Version numbering

| Rule | Implementation |
|------|----------------|
| Start at 1 | First confirm on new policy creates `version_number = 1` |
| Monotonic | `version_number = COUNT(existing) + 1` on each confirm |
| Unique per policy | `UNIQUE (policy_id, version_number)` constraint |
| No gaps required | Rejected extractions do not consume version numbers |
| Max history | API returns up to `CRM_V2_PROTECTION_MAX_VERSIONS` (30); `bounded` flag if more |

Version numbers are **per policy**, independent of `protection_policies.version` optimistic lock column.

---

## 3. Verification states on versions

| State | Client visible | In version history list | Notes |
|-------|---------------|---------------------------|-------|
| `provisional` | No | Adviser only | Not used post-insert in normal flow |
| `awaiting_review` | No | Adviser only | Rare on version row |
| `confirmed` | Yes | Yes | Standard confirm path |
| `corrected` | Yes | Yes | Adviser edited fields on confirm |
| `rejected` | No | No | Applies to extractions primarily |
| `superseded` | No | Yes (adviser) | Prior confirmed replaced |
| `archived` | No | Optional | Future archive flows |

Portfolio eligibility: `isPortfolioEligibleState()` → `confirmed` | `corrected`.

---

## 4. Supersede semantics

When adviser confirms extraction **against existing policy** (`matchPolicyId`):

```sql
UPDATE protection_policy_versions
SET verification_state = 'superseded', superseded_at = now()
WHERE id = current_confirmed_version_id
  AND verification_state = 'confirmed';
```

Then new version inserted with `confirmed` or `corrected`.

**Properties:**

- Only one non-superseded confirmed/corrected version is pointed to by `current_confirmed_version_id`
- Superseded versions are immutable — no in-place edits
- `superseded_at` timestamp supports audit timeline
- Transition `confirmed → superseded` allowed in `ADVISER_TRANSITIONS`

**Not supported Phase 07:**

- Hard DELETE of version rows
- Rewriting `structured_snapshot` on existing version
- Client-triggered supersede

---

## 5. Version payload schema

| Column | Type | Description |
|--------|------|-------------|
| `effective_date` | DATE | Often policy start |
| `sum_assured` | NUMERIC(18,2) | Nullable |
| `sum_assured_currency` | TEXT | Default `SGD` |
| `premium` | NUMERIC(18,2) | Nullable |
| `premium_frequency` | TEXT | monthly, quarterly, semi_annual, annual, single, unknown |
| `policy_term` | TEXT | Human-readable term |
| `premium_term` | TEXT | Human-readable premium paying term |
| `coverage_components` | JSONB | Array ≤30 items, category allowlist |
| `riders` | JSONB | Array ≤20 items |
| `source_extraction_id` | UUID | FK to originating extraction |
| `adviser_reviewer_id` | UUID | Confirming adviser |
| `confirmed_at` | TIMESTAMPTZ | Verification timestamp |
| `correction_reason` | TEXT | ≤500 chars when corrected |
| `structured_snapshot` | JSONB | Full field copy at confirm time |
| `version_hash` | TEXT | Hash of snapshot for dedup audit |

### 5.1 Coverage component shape

```typescript
{
  category: CrmProtectionCoverageCategory;  // allowlist
  categoryLabel: string;
  amount: number | null;
  currency: string;
  durationLabel: string | null;
  insurerWording: string | null;  // max 500
  isRider: boolean;
}
```

Categories include: `death`, `total_permanent_disability`, `critical_illness`, `early_critical_illness`, `hospitalisation`, `personal_accident`, `disability_income`, `long_term_care`, `waiver`, `savings_endowment`, `investment_linked`, `other`.

### 5.2 Rider shape

```typescript
{
  riderLabel: string;
  category: CrmProtectionCoverageCategory | null;
  amount: number | null;
  currency: string;
}
```

---

## 6. Version hash and integrity

`buildVersionHash(snapshot)` in `deduplication.ts`:

- Canonical JSON serialization of confirmed fields
- Stored on version row at insert
- Supports future "unchanged re-confirm" detection
- **Not** used to block adviser confirm Phase 07 — informational

---

## 7. Policy header optimistic locking

`protection_policies.version` integer:

- Starts at 1 on insert
- Incremented on each successful confirm header update
- UPDATE uses `.eq("version", policy.version)` — concurrent confirms on same policy: second fails validation path

Separate from `protection_policy_versions.version_number`.

---

## 8. Current confirmed pointer

`current_confirmed_version_id` FK:

```sql
FOREIGN KEY (current_confirmed_version_id)
REFERENCES protection_policy_versions(id) ON DELETE SET NULL
```

- Set on every successful confirm
- Client and adviser portfolio loaders join through this pointer
- If pointer null or version not eligible → policy omitted from client portfolio

Index: `idx_protection_policy_versions_confirmed` on `(policy_id, confirmed_at DESC)` WHERE state in confirmed/corrected.

---

## 9. Idempotency dimensions

| Operation | Key | Scope | Behavior |
|-----------|-----|-------|----------|
| Report extraction import | `idempotency_key` | `(client_id, idempotency_key)` unique partial | Return existing extraction |
| Confirm extraction | `expectedVersion` on extraction | Per extraction row | 409 if stale |
| Policy header update | `protection_policies.version` | Per policy | Failed update if stale |
| Client correction request | `idempotencyKey` | Phase 06 service request idempotency | Duplicate request collapsed |

**Version insert is NOT idempotent** — each successful confirm creates new version row (except extraction already confirmed returns early with existing IDs).

### 9.1 Early return idempotency on confirm

If extraction already has `resulting_version_id` and status `confirmed`/`corrected`:

```typescript
return { ok: true, data: { policyId, versionId } };
```

Safe for client retry after network failure.

---

## 10. Archive semantics (policy level)

`protection_policies.archived_at`:

- Non-null excludes policy from `loadPoliciesForClient` (`.is("archived_at", null)`)
- Versions remain in database
- Full archive workflow UI deferred — schema ready

---

## 11. API: version history

`GET /api/advisor-v2/protection/policies/[policyId]/versions`

- Returns `versions: AdviserProtectionVersionDto[]` descending by `version_number`
- Includes superseded versions for adviser audit
- `bounded` if > 30 versions

Client API **does not** expose version history — single confirmed view only.

---

## 12. Relationship to extractions

```text
protection_extractions (provisional)
        │ confirm
        ▼
protection_policy_versions (confirmed/corrected)
        │ FK source_extraction_id
        └── links back to extraction row

protection_extractions.resulting_version_id → version.id
```

Extraction row preserved after confirm — supports audit "what was machine-suggested vs adviser-approved" via `structured_snapshot` diff.

---

## 13. Migration constraints (202606290011)

- `CREATE TABLE IF NOT EXISTS` — rerun safe
- `DROP CONSTRAINT IF EXISTS` before CHECK recreation
- `DROP TRIGGER IF EXISTS` before trigger create
- FK from versions to extractions added after extractions table exists
- Comments on tables document client visibility rules

---

## 14. Future binder/report integration

Confirmed versions supply structured data for:

- Annual review binder sections (Phase 9F.x evolution)
- Future regenerated protection reports

Legacy PDF report generator output remains unchanged until explicit integration phase. See `docs/CRM_V2_PHASE_07_REPORT_AND_BINDER_INTEGRATION.md`.

---

## 15. Anti-patterns (rejected)

| Anti-pattern | Why rejected |
|--------------|--------------|
| UPDATE version row in place | Breaks audit trail |
| DELETE old versions | Compliance retention |
| Auto-increment version on extraction create | Versions only on confirm |
| Client selects version | Adviser authority only |
| Merge two policies automatically | Adviser match only |

---

## 16. Cross-references

- Extraction lifecycle: `docs/CRM_V2_PHASE_07_EXTRACTION_AND_VERIFICATION.md`
- Client visibility: `docs/CRM_V2_PHASE_07_CLIENT_PROTECTION_SUMMARY.md`
- Migration: `docs/CRM_V2_PHASE_07_MIGRATION_RUNBOOK.md`

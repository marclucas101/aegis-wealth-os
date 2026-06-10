# Demo Data Dictionary — Phase 4Y

**Seed version:** `4Y`  
**Email domain:** `@aegis-demo.local`  
**Currency:** SGD (fictional amounts)

---

## Personas

| Key | Name | Role | Client status | Narrative |
|-----|------|------|---------------|-----------|
| `admin` | Demo Admin | admin | — | Platform administrator |
| `advisor` | Demo Advisor | advisor | — | Assigned to all demo clients |
| `alex-tan` | Alex Tan | client | active | High-income professional; incomplete estate planning |
| `priya-nair` | Priya Nair | client | active | Business owner; concentration risk; overdue review |
| `james-lee` | James & Mei Lee | client | active | Young family; protection gap; roadmap in progress |
| `margaret-ong` | Margaret Ong | client | review_due | Pre-retiree; retirement income risk; reports on file |
| `sam-wei` | Sam Wei | client | onboarding | Thin onboarding; no Discover completion |

---

## Assumptions

- All names, employers, and figures are **fictional**
- Singapore residency and SGD used for realistic UI formatting
- Scores are computed by the **existing v1 scoring engine** from Discover form data — formulas are not modified
- `data_confidence_factor` follows engine output from completeness
- Reviews use **generated** annual review / blueprint snapshots, not uploaded PDFs
- Documents are **metadata-only** placeholders tagged `demo`, `placeholder`
- No blobs are written to Supabase Storage

---

## Seeded modules

| Module | Alex | Priya | James | Margaret | Sam |
|--------|------|-------|-------|----------|-----|
| `users` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `clients` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `discover_profiles` | ✓ | ✓ | ✓ | ✓ | — |
| `financial_profiles` | ✓ | ✓ | ✓ | ✓ | — |
| `shield_scores` | ✓ | ✓ | ✓ | ✓ | — |
| `pillar_scores` | ✓ | ✓ | ✓ | ✓ | — |
| `stress_tests` | ✓ | ✓ | ✓ | ✓ | — |
| `roadmap_items` | ✓ | ✓ | ✓* | ✓ | — |
| `client_profiles` | ✓ | ✓ | ✓ | ✓ | — |
| `wealth_blueprints` | ✓ | — | — | ✓ | — |
| `annual_reviews` | ✓ | ✓ | ✓ | ✓ | — |
| `documents` | 3 | 1 | 2 | 5 | — |
| `advisor_notes` | ✓ | ✓ | ✓ | ✓ | — |
| `advisor_tasks` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `audit_logs` | samples | | | | |

\* James has intentional roadmap statuses: emergency fund completed; protection items in progress.

---

## Expected scores and readiness (approximate)

Values are engine-computed; re-run `npm run demo:seed -- --force` after engine changes.

| Persona | Discover completeness | Shield tier | Risk / readiness | Advisor signals |
|---------|----------------------|-------------|------------------|-----------------|
| Alex Tan | High (~85%+) | Strong (A/AA range) | Good file; estate doc gap | Estate follow-up task |
| Priya Nair | High | Weaker (BBB/BB range) | **High risk**, poor readiness | Overdue review, urgent task, pinned risk note |
| James Lee | High | Moderate | Medium risk; roadmap in flight | Protection follow-up task |
| Margaret Ong | High | Moderate | Review due; good readiness | High-priority review task |
| Sam Wei | N/A | N/A | **Incomplete** / poor | Onboarding task, no scores |

### Review pipeline timing

| Persona | Last review seeded | Pipeline state |
|---------|-------------------|----------------|
| Priya Nair | ~16 months ago | **Overdue** |
| Margaret Ong | ~13 months ago | **Review due** (+ `review_due` status) |
| Alex Tan | ~6 months ago | Active |
| James Lee | ~4 months ago | Active |

### Document coverage (file-quality)

| Persona | Categories on file | Typical gaps surfaced |
|---------|-------------------|------------------------|
| Alex | insurance, investment, CPF | Estate, loan, tax |
| Priya | business ownership | Insurance, investment, CPF, estate, loan, tax |
| James | insurance, CPF | Investment, estate, loan, tax |
| Margaret | insurance, investment, CPF, will, financial | Loan, tax |
| Sam | none | All categories |

---

## Demo markers

- Auth `user_metadata.demo = true`
- Discover `form_data._demoMeta.personaKey`
- Document `tags: ['demo', 'placeholder']`
- Document `storage_path` prefix: `demo/{clientId}/`
- Report titles suffixed with `(Demo)`
- Audit `metadata.demo = true`

These markers help idempotent seeding and safe clear operations.

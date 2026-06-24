# Phase 10 — Analytics and Management Visibility Audit

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  

---

## Scope

Identify **safe aggregate reporting** that can be calculated reliably without exposing client financial details or creating misleading performance comparisons. **No adviser ranking, sales ranking, or behavioural scoring** is proposed without explicit operator approval.

---

## Existing aggregate surfaces

### Adviser command center (`lib/supabase/advisorQueries.ts`)

| Metric | Calculation | Reliable? | PII risk |
|--------|-------------|-----------|----------|
| `totalClients` | Count assigned clients | Yes | Count only |
| `activeClients` | Status filter | Partial — dual status models | Count only |
| `onboardingClients` | Status filter | Partial | Count only |
| `averageShieldScore` | Mean of scores | Yes | Aggregate only |
| `highRiskClients` | Threshold filter | Yes | Count only |
| `pendingRoadmapItems` | Open items count | Yes | Count only |
| `documentsUploaded` | Count | Yes | Count only |
| Priority clients | Rule-based shortlist | Yes | Names visible to assigned adviser only |

**UI:** `AdvisorCommandMetrics.tsx` — adviser-scoped, not firm-wide management.

### Admin dashboard (`AdminDashboardClient.tsx`)

| Metric | Source | Reliable? |
|--------|--------|-----------|
| User counts by role | Client-side from admin users API | Yes |
| Assigned vs unassigned clients | Client list | Yes |

**Gap:** No firm-wide servicing KPIs, no trend charts, no export.

### Job operations (`AdminJobOperationsClient.tsx`)

| Metric | Source |
|--------|--------|
| Scheduled publishing run outcomes | `automation_job_runs` — examined/succeeded/failed/skipped |

### Audit log analytics (manual SQL)

Documented in `docs/AUDIT_LOG_REVIEW.md`:

| Event family | Examples | Use |
|--------------|----------|-----|
| Prospect journey | discover steps | Funnel volume |
| Client portal | view events | Engagement volume |
| Compliance | publication, binder | Operational audit |

**No in-app dashboard** — requires Supabase SQL.

---

## Metrics feasibility assessment

| Metric | Can calculate reliably? | Method | Safe for aggregate? | Notes |
|--------|-------------------------|--------|---------------------|-------|
| Adviser client load | Yes | Count per `clients.advisor_id` | Yes — internal ops | Not for ranking |
| Onboarding completion | Partial | `discover_profiles.completeness` thresholds | Yes — % complete bands | Define threshold explicitly |
| Plan completion | Partial | Published output types per client | Yes — boolean has published | Not quality measure |
| Meeting cadence | Yes | `adviser_appointments` count/time | Yes | — |
| Roadmap progress | Partial | Open vs closed roadmap_items | Yes — counts | Visibility bias |
| Overdue actions | Partial | Tasks + review pipeline | Yes | Cross-source dedup needed |
| Document activity | Yes | `documents` created_at counts | Yes | Category breakdown OK |
| Communication delivery | Yes | `communication_deliveries.status` | Yes | Admin API exists |
| Client engagement | Partial | Audit log action counts | Yes — event counts | Not behavioural score |
| Review readiness | Partial | Pipeline states | Yes | — |
| Data completeness | Yes | Discover completeness + file quality | Yes | Per-client detail adviser-only |

---

## Metrics that must NOT be built without approval

- Adviser leaderboard / ranking by shield score improvement
- Sales conversion rates per adviser
- Client AUM comparisons
- Behavioural scoring of client engagement
- Performance benchmarks across advisers

---

## Misleading metric risks

| Risk | Mitigation |
|------|------------|
| Dual `status` vs `relationship_stage` inflates/deflates onboarding counts | Canonicalize in query layer before Phase 10 reporting |
| Unpublished work invisible in "plan completion" | Separate "published" from "prepared" metrics |
| Roadmap items hidden from client skews progress | Report adviser-visible vs client-visible separately |
| Small sample size with few advisers | Show counts not rates; suppress rankings |

---

## Privacy-safe reporting recommendations

1. **Adviser-scoped dashboards** — each adviser sees only assigned book aggregates (extend command center).
2. **Admin ops dashboard** — firm counts, failed jobs, delivery failures, feature flag state — no client financial fields.
3. **Audit SQL templates** — extend `AUDIT_LOG_REVIEW.md` with Phase 10 weekly queries.
4. **Defer BI tooling** — no third-party analytics vendor in Phase 10 discovery.

---

## Analytics gap summary

| Gap | Priority |
|-----|----------|
| No firm-wide ops dashboard | High (Track F overlap) |
| No trend/time-series storage | Medium — query on demand OK initially |
| Audit log read surface | Medium |
| Onboarding funnel not in-app | Low — SQL sufficient |
| Work queue metrics absent | High — depends on Track A |

---

## Conclusion

**Basic aggregates exist** for adviser book health but **management visibility is thin**. Phase 10 should embed analytics into the **Adviser Operating Dashboard** (counts, overdue bands, completeness bands) rather than building a separate analytics product. Track F addresses ops failures; Track A addresses servicing metrics — together they cover analytics gaps without ranking advisers.

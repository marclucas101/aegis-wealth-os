# CRM V2 — Compatibility and Cutover

**Phase:** 00

---

## 1. Parallel operation model (Phase 01–13)

```text
┌─────────────────────┐     ┌─────────────────────┐
│  /advisor (legacy)  │     │  /advisor-v2 (new)  │
│  Unchanged UX       │     │  Flag + pilot gated │
│  Existing APIs      │     │  New APIs namespace │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └───────────┬───────────────┘
                       ▼
              Shared authoritative data
              (clients, appointments, …)
```

**Rules during parallel operation:**

- No dual-write to competing tables
- V2 writes go to same SOT tables (when implemented) or new approved tables
- Legacy portal does not read V2-only tables until cutover
- Client portal changes are additive and flag-gated

---

## 2. Legacy adviser portal compatibility

| Concern | Strategy |
|---------|----------|
| `/advisor` routes | Frozen feature set Phase 01–13 |
| `/api/advisor/**` | No breaking changes until Phase 15 audit |
| Navigation | Legacy nav unchanged; V2 is separate entry (bookmark/direct URL until cutover) |
| Command center | Remains default when `crm_v2_master` off |
| Deep links | Existing bookmarks to `/advisor/clients/[id]` continue working |
| Tasks, suggestions | Legacy panels unchanged until cutover optional redirect |

**Phase 14 cutover:**

| Route | After cutover |
|-------|---------------|
| `/advisor` | Serves CRM V2 (same as current `/advisor-v2`) |
| `/advisor-legacy` | Time-limited fallback; `crm_v2_legacy_fallback` flag + audit |
| `/advisor-v2` | 301 → `/advisor` (optional) |

**Fallback requirements:**

- Operator-approved enable
- Adviser restricted (pilot or explicit allowlist)
- Every access audited (`crm_v2_legacy_access` event)
- Hidden from normal V2 navigation
- Recommended max 30 days post-cutover, extendable by operator

---

## 3. Client portal compatibility

| Area | Impact |
|------|--------|
| Existing routes | Preserved — no renames |
| Entitlements | `relationship_stage` gates unchanged |
| `/my-adviser` booking | Legacy flow works until Phase 04 flag on |
| Phase 04+ | Same `adviser_appointments` SOT — client APIs additive |
| Publications | Unchanged publication workflow |
| Insights | Governed content — not promotions |
| Document vault | Shared `documents` table |

**Client users never see `/advisor-v2`.**

---

## 4. Admin compatibility

| Surface | CRM V2 impact |
|---------|---------------|
| Client assignment | Unchanged — `clients.advisor_user_id` |
| Feature controls API | New CRM flags added incrementally |
| Governed content approval | Phase 10 uses existing queue |
| Promotions migration | 9F.4 only — independent of CRM |
| Audit logs | Append-only; CRM adds new event types |

---

## 5. API compatibility matrix

| Consumer | Legacy API | V2 API | Phase 15 action |
|----------|------------|--------|-----------------|
| Legacy adviser UI | `/api/advisor/**` | — | Retire mutations when unused |
| CRM V2 UI | — | `/api/advisor-v2/**` | Primary |
| Client portal | `/api/client/**`, `/api/my-adviser/**` | Extended in Phase 04/06 | Keep if V2 depends |
| Mobile/scripts | Unknown | — | Audit in Phase 15 |

**No API removal** until Phase 15 dependency audit passes.

---

## 6. Data compatibility

| Scenario | Handling |
|----------|----------|
| Legacy appointment status | Mapped to CRM lifecycle on read (Phase 03) |
| `clients.status` vs `relationship_stage` | CRM writes `relationship_stage`; reads both during transition |
| Birthday tasks | `advisor_tasks` with `client_birthday` — moments engine may supersede display, not delete tasks |
| Protection PDFs in vault | Remain; structured policies additive |
| Published outputs | Unchanged versioning |
| Binder exports | Unchanged lineage (9F.3) |

---

## 7. Cutover checklist (Phase 14)

| Step | Action |
|------|--------|
| 1 | Phase 13 pilot sign-off recorded |
| 2 | Production comparison report — assigned client counts match |
| 3 | Enable `crm_v2_cutover` on staging — smoke test |
| 4 | Operator production approval |
| 5 | Enable `crm_v2_cutover` production |
| 6 | `/advisor` serves V2 |
| 7 | Enable `crm_v2_legacy_fallback` for restricted fallback |
| 8 | Start 30-day observation (Day 0 record) |
| 9 | Monitor fallback usage, 500 rate, support tickets |
| 10 | Day 30 — operator sign-off or rollback |

---

## 8. Rollback procedure (cutover)

| Step | Action |
|------|--------|
| 1 | Set `crm_v2_cutover = false` |
| 2 | `/advisor` serves legacy application |
| 3 | Communicate to pilot advisers |
| 4 | Investigate defects — no schema deletion |
| 5 | V2 data in new tables retained for retry |

Rollback does **not** delete appointments, commitments, or audit history created during V2.

---

## 9. Observation period (Phase 14)

Track (aggregate only):

| Metric | Source |
|--------|--------|
| Fallback route hits | Audit events |
| Access failures | Error logs (no PII) |
| Missing workflows | Support + pilot feedback |
| Sync defects | Google sync failure count |
| Data mismatches | Phase 13 comparison queries |
| Legacy-only dependencies | Phase 15 audit input |

Align with Phase 9F.4 observation discipline — separate trackers, same rigor.

---

## 10. Phase 15 legacy retirement (conditional)

**Preconditions:**

- CRM V2 observation complete (30+ days)
- Fallback usage negligible
- No legacy-only workflows
- Operator approval recorded
- Dependency audit passes

**Actions:**

- Remove legacy UI routes (redirect to V2 or stable 410)
- Retire obsolete mutation APIs with stable error responses
- Retain read APIs used by client portal or V2
- **Do not** drop business tables
- Document rollback limitations (UI-only rollback post-retirement)

---

## 11. Dual-write prohibition

Unless explicitly designed and documented:

- Queue completion must not bypass source mutation
- Timeline projection must not write back to sources
- Google sync must not create second appointment row
- Protection extraction must not auto-confirm

---

## 12. Integration with Phase 9F.4

CRM V2 cutover is **independent** of Promotions Stage 6:

- Promotions schema remains during CRM observation
- `legacy_promotions_write` stays false
- CRM communications use governed content path
- Do not conflate CRM cutover sign-off with Promotions schema drop sign-off

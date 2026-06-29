# CRM V2 — Phase 02 Security Review

**Phase:** 02  
**Verdict:** No unresolved defects identified in static review

---

## Threat table

| Threat | Control |
|--------|---------|
| Cross-adviser IDOR | `resolveAccessibleClient` via `resolveAuthorizedRelationship`; forbidden → `not_found` |
| Forged UUID | Invalid UUID → `not_found`; no existence leak |
| Client portal access | `requireAdvisorAccess` chain; client role denied at adviser gate |
| Feature bypass | `crm_v2_relationships` required in addition to master + pilot |
| List-only auth for detail | Detail page + API independently resolve assignment |
| Sensitive DTO leak | No NRIC, policy numbers, amounts, ethnicity, advocacy, storage paths |
| Arbitrary redirect URLs | `isAllowlistedRelationshipLink` on workflow links |
| Browser-supplied adviser ID | Session-derived identity only |
| Timeline source ID leak | Projected IDs are source-scoped; no unrelated client IDs in entries |

---

## API headers

`Cache-Control: private, no-store` on relationship APIs.

---

## Migration safety

`202606290002_phase02_crm_v2_relationships_feature_control.sql` — INSERT seed only, `ON CONFLICT DO NOTHING`, default disabled.

---

## Mock tests

`lib/crm-v2/relationships/accessTests.ts` — assignment-scope fixtures without production connection.

---

## Operator note

Runtime penetration testing requires enabled flags + pilot allowlist on staging. Automated QA uses static and mock checks only unless operator executes manual checklist.

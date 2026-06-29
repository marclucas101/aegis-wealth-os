# CRM V2 — Phase 02 Relationship Architecture

**Phase:** 02 — Relationship list + Relationship 360  
**Branch:** `crm-v2-02-relationship-360`  
**Feature key:** `crm_v2_relationships`

---

## Purpose

Replace the Phase 01 Relationships placeholder with a secure, read-first CRM relationship workspace organised along:

```text
RELATIONSHIP → ENGAGEMENT → ADVICE → SERVICE
```

Phase 02 does **not** create a duplicate relationship database. `relationshipId` equals existing `clients.id` as a single-person relationship.

---

## Routes

| Route | Implementation |
|-------|----------------|
| `/advisor-v2/relationships` | Assigned-book list (API-backed client UI) |
| `/advisor-v2/relationships/[relationshipId]` | Relationship 360 (server read model) |
| `GET /api/advisor-v2/relationships` | Paginated list DTO |
| `GET /api/advisor-v2/relationships/[relationshipId]` | 360 aggregate DTO |

---

## Access sequence

```text
assertCrmV2RelationshipsAccess()
  → assertCrmV2Access() (master + pilot)
  → isFeatureEnabled('crm_v2_relationships')
```

Detail routes independently call `resolveAuthorizedRelationship()` — list authorization does not substitute for detail authorization.

---

## Six workspace sections

| Tab | Source |
|-----|--------|
| Overview | Client lifecycle, discover, tasks, roadmap, appointments |
| Financial Plan | Allowlisted links to legacy discover, planning, roadmap, protection |
| Engagement | Projected timeline (no persistence table) |
| Service | Tasks, roadmap, reviews — Phase 06 notice |
| Documents | Vault / binder / output summaries — no storage paths |
| Relationship Profile | Safe client profile fields — Phase 08/09 placeholders |

---

## Future household compatibility

When household grouping is approved, `relationshipId` may map to a household entity while retaining `clientId` for person-level sources. Phase 02 types reserve `relationshipKind: "single_person"` only.

---

## File map

| Path | Role |
|------|------|
| `lib/crm-v2/relationships/identity.ts` | Canonical identity + assignment resolution |
| `lib/crm-v2/relationships/listQueries.ts` | Bounded list projection |
| `lib/crm-v2/relationships/readModel.ts` | Centralized 360 assembly |
| `lib/crm-v2/relationships/timelineProjection.ts` | Engagement timeline |
| `lib/crm-v2/relationships/serviceProjection.ts` | Service read projection |
| `lib/crm-v2/relationships/documentProjection.ts` | Document summaries |
| `components/aegis/advisor-v2/relationships/*` | List + 360 UI |

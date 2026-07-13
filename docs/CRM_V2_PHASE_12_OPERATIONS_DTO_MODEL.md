# CRM V2 Phase 12 — Operations DTO Model

**Types:** `lib/crm-v2/operations/types.ts`

---

## OperationsPanelDto

| Field | Purpose |
|-------|---------|
| `panelKey` | Stable panel identifier |
| `title` | Safe display title |
| `summary` | Bounded description |
| `statusLevel` | `healthy` / `attention` / `warning` / `unknown` |
| `safeCount` | Optional aggregate count |
| `sourceModule` | Originating module |
| `routeHref` | Optional allowlisted link |
| `actionLabel` | Safe action text — not a mutation by itself |
| `freshnessAt` | Projection timestamp |
| `partialDataWarning` | Partial failure flag |

## FeatureControlStatusDto

| Field | Purpose |
|-------|---------|
| `featureKey` | Approved platform key |
| `enabled` | Current enabled state |
| `adviserVisible` | Adviser visibility flag |
| `clientVisible` | Client visibility flag |
| `pilotRequired` | Whether pilot gate applies conceptually |
| `description` | Safe description from controls row |
| `lastUpdatedAt` | Row timestamp if available |

## Excluded

Tokens, secrets, raw provider responses, raw SQL errors, policy numbers, storage paths, signed URLs, contact details, private notes, full message bodies, service-role metadata.

## Projection DTO

`AdviserOperationsProjectionDto` — generatedAt, requestId, sections, sourceFailures, environmentWarnings, adminScopeDeferred.

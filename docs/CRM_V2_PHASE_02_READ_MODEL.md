# CRM V2 — Phase 02 Read Model

**Module:** `lib/crm-v2/relationships/readModel.ts`  
**Entry:** `loadCrmRelationship360(client, activeTab, requestId)`

---

## Responsibilities

1. Resolve authorized relationship (caller provides assigned client row)
2. Batch-load supplementary context (appointments, discover, tasks, roadmap, outputs, binders)
3. Delegate timeline, service, and document projections
4. Assemble header, overview panels, financial-plan links, profile fields
5. Return safe diagnostics (`sourceWarnings`, `timingMs`) — no raw DB errors to client

---

## Batching strategy

| Batch | Tables |
|-------|--------|
| Context | `adviser_appointments`, `meeting_sessions`, `advisor_tasks`, `discover_profiles`, `roadmap_items`, `published_outputs`, `binder_exports`, `documents`, `users` |
| Timeline | Same sources as engagement spec — bounded to `CRM_V2_TIMELINE_MAX_ENTRIES` |
| Service | `advisor_tasks`, `roadmap_items`, `annual_reviews` — bounded to `CRM_V2_SERVICE_MAX_ITEMS` |
| Documents | `documents`, `binder_exports`, `published_outputs` — bounded to `CRM_V2_DOCUMENTS_MAX_SUMMARY` |

---

## Partial failure

Each projection `.catch()` adds a `sourceWarnings` token; other sections still render. No service-role expansion beyond existing `createAdminSupabaseClient()` pattern used by legacy adviser loaders.

---

## No writes

Read model performs **no** inserts, updates, or deletes.

---

## DTO boundary

Public shape is `CrmRelationship360` in `lib/crm-v2/relationships/types.ts`. Raw `AppClientRow` is not exposed to API responses — only mapped safe fields.

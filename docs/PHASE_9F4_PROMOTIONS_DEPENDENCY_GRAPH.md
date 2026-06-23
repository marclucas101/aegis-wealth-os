# Phase 9F.4 — Promotions Dependency Graph

**Checkpoint:** 9F.4 Checkpoint 1 (audit only)

## Forward dependency graph

```text
DATABASE
├── public.promotions
│   ├── FK: created_by → auth.users
│   ├── indexes: status_priority, ends_at
│   ├── triggers: promotions_set_updated_at
│   └── RLS: client published SELECT; adviser CRUD
├── promotion-assets (storage bucket)
│   └── path: {userId}/promotions/{promotionId}/{file}
└── promotion_migration_reviews
    ├── FK: promotion_id → promotions
    └── FK: migrated_content_id → governed_content

PERSISTENCE
└── lib/supabase/promotionsPersistence.ts
    ├── createAdminSupabaseClient() [service role]
    ├── createServerSupabaseClient() [client list only]
    └── storage signed URLs (300s expiry)

SERVICES
├── lib/aegis/promotions.ts (types, isPromotionCurrentlyActive)
└── lib/communications/legacyPromotionsMigration.ts
    ├── classifyPromotion()
    ├── migratePromotionToDraft() → governed_content
    └── listUnmigratedPromotions()

ROUTES
├── GET /api/promotions → listPublishedPromotions [user session]
├── /api/advisor/promotions* → service-role CRUD + audit
└── POST /api/admin/promotions-migration → migration service

UI
├── app/promotions → PromotionsClient → GET /api/promotions
└── app/advisor/promotions → PromotionsManagerClient → adviser API

NAV / ACCESS
├── lib/navigation.ts (catalogue links)
├── lib/compliance/entitlements.ts (promotions=false)
├── middleware.ts (auth gate)
└── lib/compliance/postAuthRouting.ts (redirect allowlist)

AUDIT
├── promotion_created / promotion_updated / promotion_published
└── promotion_migration_draft_created

NOTIFICATIONS
└── (none) — promotions do not emit lifecycle notifications
```

---

## Reverse dependencies — who still needs legacy Promotions?

| Consumer | Depends on promotions? | Evidence | Classification |
|----------|------------------------|----------|----------------|
| **Phase 9E communications** | **No** (runtime) | `insightsFeedService.ts` reads `governed_content` only; QA test enforces | **Safe to deprecate** legacy client feed |
| **Scheduled publishing** | **No** | `scheduledContentEligibility.ts` — governed_content only | **Safe to deprecate** |
| **Lifecycle notifications** | **No** | Wired to publications + governed content | **Safe to deprecate** |
| **Publication workflow (9A)** | **No** | `published_outputs` separate table | **Safe to deprecate** |
| **Client portal** | **Partial** | `/promotions` dormant; `/insights` is replacement | **Replace before removal** |
| **Adviser workspace** | **Yes** | `/advisor/promotions` active nav + CRUD | **Replace before removal** |
| **Feature controls** | **No direct flag** | `insights_and_updates` covers replacement | **Safe to deprecate** |
| **Audit reports** | **Historical** | Audit actions reference `promotions` entity | **Keep** audit history |
| **Admin migration** | **Yes** | Reads `promotions` + writes `governed_content` | **Keep** through migration |
| **Binder (9F.3)** | **No** | No import of promotions modules | **Do not alter** |
| **Document vault** | **No** | Separate persistence | **Safe to deprecate** |

---

## Cross-subsystem reference map

```text
governed_content ← promotion_migration_reviews.migrated_content_id
audit_logs ← entity_type "promotions" / actions promotion_*
platform_feature_controls ← insights_and_updates (replacement channel)
communication_preferences ← promotional_content (replacement audience filter)
```

**No FK from non-promotions tables → promotions** except `promotion_migration_reviews`.

---

## Dynamic references (static search cannot prove)

| Reference | Risk | Mitigation |
|-----------|------|------------|
| External scripts calling `/api/advisor/promotions` | Unknown | Operator inventory of integrations |
| Direct Supabase client writes to `promotions` (RLS allows adviser) | Low-Medium | Service-role is primary path; monitor audit |
| Bookmarked `/promotions` client URLs | Low | Redirect to `/insights` in implementation |
| Demo seed data including promotions | Unknown | Check `scripts/seed-demo-data.ts` before schema retirement |
| Remote storage orphans in `promotion-assets` | Medium | Preflight row counts + storage listing (operator) |

---

## Phase 9E replacement dependency (parallel stack)

```text
governed_content
  → contentWorkflow.ts
  → insightsFeedService.ts
  → /insights UI
  → scheduledContentEligibility.ts (Phase 9F)
  → lifecycleNotificationService.ts (Phase 9F.2)
```

Legacy promotions **does not participate** in this graph at runtime.

---

## Blockers to removal (current)

1. **Active adviser CRUD** — `/advisor/promotions` + APIs still functional.
2. **Unmigrated rows** — `listUnmigratedPromotions()` may return records (operator preflight).
3. **Audit history** — `audit_logs` reference promotion entities.
4. **Storage assets** — `promotion-assets` bucket may contain files.
5. **RLS client SELECT** — authenticated users can still read published promotions via API.

---

## Safe deprecation order (dependency-respecting)

```text
Stage A: Freeze new promotion writes (feature flag or route guard) — no schema change
Stage B: Migrate remaining rows via admin migration API
Stage C: Remove UI + API routes
Stage D: Observe /insights-only period
Stage E: Optional read-only schema + storage retention
Stage F: Optional destructive schema cleanup (later checkpoint)
```

See `PHASE_9F4_RETIREMENT_ARCHITECTURE.md` for selected model.

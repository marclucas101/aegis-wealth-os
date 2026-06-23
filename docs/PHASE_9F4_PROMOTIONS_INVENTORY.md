# Phase 9F.4 — Legacy Promotions Inventory

**Checkpoint:** 9F.4 Checkpoint 1 (audit only)  
**Search terms:** promotion, promotions, campaign, marketing_content, promotional, promo

---

## Database objects

| Object | Kind | Current use | Called by | Calls into | Replacement | Data retention | Proposed action | Risk |
|--------|------|-------------|-----------|------------|-------------|----------------|-----------------|------|
| `public.promotions` | DB table | Active — CRUD via adviser API | `promotionsPersistence.ts`, RLS client SELECT | `auth.users`, storage paths | `governed_content` (Phase 9E) | Historical rows + audit refs | **Migrate** active; **deprecate** writes | High |
| `promotions_status_check` | DB constraint | Active | INSERT/UPDATE | — | governed `approval_status` | N/A | Keep until schema retirement | Low |
| `promotions_audience_check` | DB constraint | Active (`all_users` only) | INSERT/UPDATE | — | `audience_scope` on governed_content | N/A | Keep until retirement | Low |
| `promotions_status_priority_idx` | DB index | Active | list queries | — | governed_content indexes | N/A | Keep until retirement | Low |
| `promotions_ends_at_idx` | DB index | Active | active published filter | — | governed expiry indexes | N/A | Keep until retirement | Low |
| `promotions_set_updated_at` | DB trigger | Active | UPDATE | `set_updated_at()` | governed_content trigger | N/A | Keep until retirement | Low |
| `promotions_select_published_active` | RLS policy | Active | client session SELECT | — | governed_content API-only access | N/A | **Deprecate** with route retirement | Medium |
| `promotions_select_advisor` | RLS policy | Active | adviser SELECT all | — | — | N/A | Deprecate later | Low |
| `promotions_insert/update/delete_advisor` | RLS policies | Active (defense-in-depth) | direct Supabase client | — | — | N/A | Deprecate later | Low |
| `promotion-assets` storage bucket | DB/storage | Active | upload + signed URLs | `promotions.image_url`, `attachment_url` | governed content assets (if any) | Files on disk | **Migrate** referenced assets; retain until copied | Medium |
| `promotion_migration_reviews` | DB table | Active — migration tracking | `legacyPromotionsMigration.ts`, admin API | `promotions`, `governed_content` | Self (audit trail) | **Retain** indefinitely | **Keep** | Low |
| `202606100016_promotions.sql` | Migration | Applied | schema history | — | — | N/A | **Keep** (no destructive rollback) | Low |

---

## API routes

| Object | Kind | Current use | Called by | Calls into | Replacement | Data retention | Proposed action | Risk |
|--------|------|-------------|-----------|------------|-------------|----------------|-----------------|------|
| `GET /api/promotions` | API | Active (callable) | `PromotionsClient.tsx` | `listPublishedPromotions` | `GET /api/client/insights` feed | N/A | **Deprecate** | Medium |
| `GET/POST /api/advisor/promotions` | API | Active | `PromotionsManagerClient` | `listAdvisorPromotions`, `createPromotion` | `/api/advisor/insights` | N/A | **Deprecate** | Medium |
| `GET/PATCH /api/advisor/promotions/[promotionId]` | API | Active | `PromotionForm`, manager | `getAdvisorPromotionById`, `updatePromotion` | governed content routes | N/A | **Deprecate** | Medium |
| `POST .../upload` | API | Active | `PromotionForm` | `uploadPromotionAsset` | governed content asset flow | Storage objects | **Deprecate** after asset migration | Medium |
| `POST /api/admin/promotions-migration` | API | Active (no UI) | External/admin tooling | `legacyPromotionsMigration.ts` | One-time migration | Review records | **Keep** through Stage 3 | Low |

---

## UI pages and components

| Object | Kind | Current use | Called by | Calls into | Replacement | Proposed action | Risk |
|--------|------|-------------|-----------|------------|-------------|-----------------|------|
| `app/promotions/page.tsx` | UI page | Dormant (nav hidden) | Direct URL | `PromotionsClient` | `app/insights/page.tsx` | **Deprecate** | Low |
| `app/advisor/promotions/page.tsx` | UI page | Active | Adviser nav | `PromotionsManagerClient` | adviser insights authoring | **Deprecate** | Medium |
| `components/aegis/promotions/PromotionsClient.tsx` | UI | Active code | client page | `/api/promotions` | insights components | **Deprecate** | Low |
| `components/aegis/promotions/PromotionCard.tsx` | UI | Active code | PromotionsClient | — | insights card | **Deprecate** | Low |
| `components/aegis/promotions/PromotionsEmptyState.tsx` | UI | Active code | PromotionsClient | — | — | **Deprecate** | Low |
| `components/aegis/advisor/promotions/PromotionsManagerClient.tsx` | UI | Active | adviser page | adviser promotions API | Admin/adviser comms UI | **Deprecate** | Medium |
| `components/aegis/advisor/promotions/PromotionForm.tsx` | UI | Active | manager | CRUD + upload API | governed content form | **Deprecate** | Medium |
| `components/aegis/advisor/promotions/PromotionListTable.tsx` | UI | Active | manager | — | — | **Deprecate** | Low |
| `components/aegis/advisor/promotions/PromotionPreview.tsx` | UI | Active | form | — | — | **Deprecate** | Low |

---

## Library modules

| Object | Kind | Current use | Called by | Calls into | Replacement | Proposed action | Risk |
|--------|------|-------------|-----------|------------|-------------|-----------------|------|
| `lib/aegis/promotions.ts` | Types | Active | persistence, components | — | `lib/communications/types.ts` | **Deprecate** after route removal | Low |
| `lib/supabase/promotionsPersistence.ts` | Persistence | Active | all promotion APIs | admin client, storage | `governedContentPersistence.ts` | **Deprecate** | High |
| `lib/communications/legacyPromotionsMigration.ts` | Service | Active (migration) | admin migration API | governed content, audit | Self during transition | **Keep** through migration | Low |

---

## Navigation and routing

| Object | Kind | Current use | Called by | Replacement | Proposed action | Risk |
|--------|------|-------------|-----------|-------------|-----------------|------|
| `lib/navigation.ts` — `/promotions` | Nav catalogue | Listed in full catalogue; **not** in active client nav | `getNavSectionsForRole` | `/insights` | **Deprecate** link | Low |
| `lib/navigation.ts` — `/advisor/promotions` | Nav | Active (`advisorOnly`) | Adviser shell | `/advisor/insights` or comms | **Deprecate** | Low |
| `middleware.ts` — `/promotions` | Middleware | Auth-only protected prefix | All requests | — | **Deprecate** with page | Low |
| `lib/compliance/postAuthRouting.ts` | Routing | `/promotions` in active-client allowlist | post-login redirect | `/insights` | **Update** in implementation | Low |
| `lib/compliance/entitlements.ts` — `promotions` feature | Entitlement | Hardcoded `false` for active clients | nav filtering | `insights_and_updates` | **Remove** key in later cleanup | Low |

---

## Feature flags and entitlements

| Object | Kind | Current use | Replacement | Proposed action | Risk |
|--------|------|-------------|-------------|-----------------|------|
| `ClientFeatureKey: "promotions"` | Type | Defined; forced off | `insights_and_updates` | **Safe to deprecate** | Low |
| `insights_and_updates` platform flag | Feature control | Active client channel | — | **Keep** | Low |
| `product_related_content` | Feature control | Blocks promotional governed content | — | **Keep** | Low |
| `admin_content_approval` | Feature control | Approval workspace + migration API | — | **Keep** | Low |
| No `legacy_promotions_*` flag | — | Not created (per checkpoint) | Proposed in feature plan | Document only | Low |

---

## Jobs and scheduling

| Object | Kind | Current use | Calls promotions? | Proposed action | Risk |
|--------|------|-------------|-------------------|-----------------|------|
| `lib/jobs/scheduledContentEligibility.ts` | Job | Active — `governed_content` only | **No** | **Keep** | Low |
| Automation cron (Phase 9F) | Job | Scheduled governed publish | **No** | **Keep** | Low |

**Finding:** No background job reads or publishes `promotions` rows.

---

## Notifications and audit

| Object | Kind | Current use | Proposed action | Risk |
|--------|------|-------------|-----------------|------|
| Audit: `promotion_created` | Audit action | Active on create | **Retain** history | Low |
| Audit: `promotion_updated` / `promotion_published` | Audit action | Active on PATCH | **Retain** history | Low |
| Audit: `promotion_migration_draft_created` | Audit action | Migration | **Retain** history | Low |
| Lifecycle notifications | Notification | **No promotion events** | N/A | Low |
| `communication_preferences.promotional_content` | Preference | Governs insights feed promos | **Keep** (replacement path) | Low |

---

## Tests and diagnostics

| Object | Kind | Current use | Proposed action | Risk |
|--------|------|-------------|-----------------|------|
| `scripts/run-phase9e-communications-validation.ts` | Test | Asserts insights does not read promotions | **Keep** | Low |
| `scripts/check-advisor-access-control.ts` | Test | May reference promotions routes | **Update** when routes removed | Low |
| `supabase/diagnostics/verify_202606200006_communications.sql` | Diagnostic | References `promotion_migration_reviews` | **Keep** | Low |
| `supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql` | Diagnostic | New read-only preflight | **Keep** | Low |

---

## Documentation (legacy references)

| Object | Kind | Proposed action |
|--------|------|-----------------|
| `docs/PHASE_9E_LEGACY_PROMOTIONS_MIGRATION.md` | Doc | **Keep** — migration runbook |
| `docs/PHASE_9E_COMMUNICATIONS_AUDIT.md` | Doc | **Keep** — historical |
| `docs/PHASE_7_*` promotion mentions | Doc | **Keep** — baseline |
| Phase 9F.4 audit docs (this checkpoint) | Doc | **Keep** |

---

## Environment and configuration

| Object | Kind | Current use | Proposed action | Risk |
|--------|------|-------------|-----------------|------|
| No promotion-specific env vars | — | Bucket configured in migration | N/A | Low |
| `PROMOTION_BUCKET = "promotion-assets"` | Code constant | Active | Remove with persistence module | Low |

---

## Items with no repository match

| Term | Finding |
|------|---------|
| `marketing_content` | **Not found** as table or module |
| `marketing campaign` | Category label only (`Limited Campaign` in `PROMOTION_CATEGORIES`) |
| `campaign` (standalone table) | **Not found** |

---

## Summary counts

| Category | Active | Dormant | Unknown |
|----------|--------|---------|---------|
| DB objects | 11 | 0 | 0 |
| API routes | 5 | 0 | 0 |
| UI surfaces | 2 pages + 7 components | 1 client page (nav-hidden) | 0 |
| Lib modules | 3 | 0 | 0 |
| Jobs referencing promotions | 0 | — | — |

**Verdict:** Legacy Promotions remains **fully wired** on the adviser side; client channel is **intentionally dormant** (`promotions` entitlement hardcoded off). Replacement path via Phase 9E is **implemented** but migration is **incomplete** (API-only, no admin UI).

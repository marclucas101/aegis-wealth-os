# Phase 9F.4 — Replacement Mapping (Legacy Promotions → Phase 9E/9F)

**Checkpoint:** 9F.4 Checkpoint 1 (audit only)

## Capability mapping

| Legacy capability | Replacement | Status | Notes |
|-------------------|-------------|--------|-------|
| Promotion draft/create | `createContentDraft` / adviser insights API | **Fully replaced** | Governed content authoring |
| Promotion categories | `GovernedContentCategory` + validation | **Fully replaced** | Includes `financial_education`, `market_update`, `event`, `promotional_product` |
| Self-serve adviser publish | Admin approve → publish workflow | **Fully replaced** | Stricter governance |
| Client promotions feed (`/promotions`) | `/insights` + `insightsFeedService` | **Fully replaced** | Client nav uses Insights only |
| Scheduled start/end dates | `scheduled_at`, `expires_at` on governed_content | **Fully replaced** | Phase 9F automation on governed rows |
| Audience `all_users` | `audience_scope` + targeting | **Partially replaced** | Finer scopes (prospect, active, assigned) — not 1:1 with legacy global audience |
| Priority ordering | Governed content sort rules | **Partially replaced** | No direct `priority` column equivalent |
| Image/attachment assets | Governed content body/external URL | **Partially replaced** | Rich asset pipeline differs; migration copies `cta_url` only |
| Product/campaign promos | `promotional_product` + `product_related_content` flag | **Fully replaced** | Default disabled |
| Market updates | `market_update` category + `market_updates` flag | **Fully replaced** | Requires admin approval |
| Client events | `event` category | **Fully replaced** | |
| Adviser CRUD UI | Adviser insights + Admin comms workspace | **Partially replaced** | Adviser creates; admin publishes |
| Audit trail | `audit_logs` + governed content audit actions | **Fully replaced** | Legacy promotion audit actions remain historical |
| In-app notifications on publish | `deliverPublicationNotifications` | **Fully replaced** | Promotions had no notification wiring |
| Communication preferences opt-out | `promotional_content` preference | **Fully replaced** | Applies to insights feed |
| Legacy migration tool | `legacyPromotionsMigration.ts` + admin API | **Fully replaced** (tooling) | UI missing |
| Global firm-wide broadcast | `all_active_clients` audience scope | **Fully replaced** | With preference filtering |
| Promotion-specific RLS client read | API-only governed_content access | **Fully replaced** | Stronger isolation |

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Fully replaced** | Replacement path exists and is production-wired |
| **Partially replaced** | Core function exists; gaps must close before legacy removal |
| **Not replaced** | No equivalent |
| **Intentionally obsolete** | Deliberately removed from product |

---

## Partially replaced — do not remove yet

| Gap | Legacy behavior | Replacement gap | Action before removal |
|-----|-----------------|-----------------|----------------------|
| Asset migration | Image + PDF attachments in `promotion-assets` | Migration copies title/summary/cta only | Extend migration or manual asset handling |
| Priority sort | `priority` integer | Insights sort by published date | Operator decision on ordering |
| Admin migration UI | API-only | No admin workspace button | Build UI or runbook for operator |
| Active published promotions | May exist in DB | Clients see via RLS if API called | Migrate or archive rows |

---

## Intentionally obsolete

| Capability | Rationale |
|------------|-----------|
| Adviser self-publish without compliance review | Replaced by admin approval (Phase 9E policy) |
| Client `/promotions` nav item | Replaced by Insights & Updates |
| `audience: all_users` unscoped RLS | Replaced by governed audience targeting + preferences |
| Ungoverned promotional_product publish | Blocked by `product_related_content` default off |

---

## Data migration requirements

| Data class | Migration required? | Target | Retention |
|------------|----------------------|--------|-----------|
| Active campaign content (published) | **Yes** — if still business-relevant | `governed_content` drafts + approval | Operator selects rows via migration API |
| Scheduled future promotions (`starts_at` future) | **Yes** | `governed_content` with `scheduled_at` | Map dates in implementation |
| Archived/expired promotions | **Optional** | Skip (`expired` classification) | Keep in `promotions` read-only |
| Audience assignments | **N/A** — legacy was global | `all_active_clients` in migration | — |
| Publication history | **Yes** (audit) | Retain `audit_logs`; link via `promotion_migration_reviews` | **Retain** |
| Notification history | **N/A** | Promotions never notified | — |
| Approval records | **Yes** for migrated content | `governed_content.approved_by_*` | New approvals required post-migration |
| Storage assets | **Conditional** | Copy to governed asset store or link externally | Operator decision |

---

## Classification summary

| Area | Classification |
|------|----------------|
| Client-facing promotions feed | **Fully replaced** → safe to deprecate routes |
| Adviser authoring | **Partially replaced** → migrate workflows before UI removal |
| Compliance approval | **Fully replaced** (admin path) |
| Scheduling | **Fully replaced** (governed_content + Phase 9F) |
| Notifications | **Fully replaced** |
| Audit history | **Retain** — do not delete |
| Storage assets | **Unknown / operator decision** |

**Do not remove partially replaced functionality** until asset migration and active row inventory are complete.

---

## Checkpoint 4 — Application retirement mapping

Legacy entry points now redirect or return explicit retirement responses. Governed Communications paths are the sole product surfaces for new work.

| Legacy entry | CP4 behaviour | Replacement |
|--------------|---------------|-------------|
| `/advisor/promotions` | Redirect | `/advisor/insights?legacy_promotions_retired=1` |
| `/promotions` | Redirect | `/insights?legacy_promotions_retired=1` |
| `GET/POST /api/advisor/promotions` | **410** `LEGACY_PROMOTIONS_RETIRED` | Insights Authoring + admin approval |
| `GET/PATCH /api/advisor/promotions/[id]` | **410** | Same |
| `POST …/upload` | **410** | Governed content (no legacy asset upload) |
| `GET /api/promotions` | `{ ok: true, promotions: [], retired: true, replacement: "insights" }` | `/insights` feed |
| Admin migration | Retained | `/admin/promotions-migration` |

**Production inventory:** `promotions` row count = **0** — client feed and migration queue operate on governed content and review records only.

**Assets:** `promotion-assets` bucket retained; automatic asset copy remains **partially replaced** (blocked per asset policy).

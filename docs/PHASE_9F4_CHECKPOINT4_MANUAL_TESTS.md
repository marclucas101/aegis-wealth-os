# Phase 9F.4 Checkpoint 4 — Manual Tests

Run after Checkpoint 4 application retirement is deployed. Prerequisites: migrations `202606200011` and `202606200012` applied; `legacy_promotions_write = false`.

---

## Environment matrix

| Environment | Purpose |
|-------------|---------|
| Staging | Full retirement behaviour + runtime gate verification |
| Production | Spot-check after deploy; production `promotions` count = **0** |

---

## 1. Adviser page redirect

1. Sign in as adviser (or admin with adviser access).
2. Navigate to `/advisor/promotions`.
3. **Expect:** HTTP redirect to `/advisor/insights?legacy_promotions_retired=1`.
4. **Expect:** Amber `LegacyPromotionsRetiredNotice` visible on Insights Authoring page.
5. **Expect:** Audit log entry `legacy_promotions_replacement_redirected` with `action_type: advisor_page`.

---

## 2. Client page redirect

1. Sign in as active client.
2. Navigate to `/promotions`.
3. **Expect:** Redirect to `/insights?legacy_promotions_retired=1`.
4. **Expect:** Retired notice on Insights & Updates page.
5. **Expect:** Audit log `legacy_promotions_replacement_redirected` with `action_type: client_page` (when authenticated client).

---

## 3. Adviser API retirement (410)

Use authenticated adviser session (cookie or test harness).

| Request | Expect |
|---------|--------|
| `GET /api/advisor/promotions` | **410** — `{ error: { code: "LEGACY_PROMOTIONS_RETIRED", … } }` |
| `POST /api/advisor/promotions` | **410** same body |
| `GET /api/advisor/promotions/{validUuid}` | **410** same body |
| `PATCH /api/advisor/promotions/{validUuid}` | **410** same body |
| `POST /api/advisor/promotions/{validUuid}/upload` | **410** same body |

Additional checks:

6. Unauthenticated requests → **401** before retirement body.
7. Non-adviser role → **403**.
8. Mutation requests audit `legacy_promotions_retired_mutation_blocked`.
9. GET list audits `legacy_promotions_retired_route_accessed`.
10. Responses include `Cache-Control: private, no-store`.

---

## 4. Client API compatibility

| Request | Expect |
|---------|--------|
| `GET /api/promotions` (client) | **200** — `{ ok: true, promotions: [], retired: true, replacement: "insights" }` |
| Unauthenticated | **401** |
| Adviser or admin session | **403** — client access required |

---

## 5. Feature flag independence (adviser APIs)

1. Temporarily enable `legacy_promotions_write` in **staging only**.
2. Retry `POST /api/advisor/promotions`.
3. **Expect:** Still **410** `LEGACY_PROMOTIONS_RETIRED` (permanent application retirement).
4. Disable flag again.

---

## 6. Admin migration review (retained)

1. Sign in as admin with `admin_content_approval`.
2. Open `/admin/promotions-migration`.
3. **Expect:** Page loads; list fetches successfully.
4. `GET /api/admin/promotions-migration` → **200** with `retirement.legacyPromotionsRetired: true`.
5. **Expect:** `retirement.migrationExecutionRestricted: true` when `PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE` is unset.
6. Select a row (or empty state if production count 0) — detail/preview/review PATCH succeed when rows exist.

---

## 7. Runtime gate (migrate blocked)

1. With runtime acceptance **not** complete, `POST /api/admin/promotions-migration/{id}/migrate` with valid body.
2. **Expect:** **403** — `{ error: { code: "PHASE9F4_MIGRATION_RUNTIME_GATE_INCOMPLETE", … } }`.
3. Same for legacy `POST /api/admin/promotions-migration` with `promotionId`.
4. After staging acceptance, set `PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE=true` on staging and confirm migrate succeeds for fixture data only.

---

## 8. Navigation

1. Client nav shows **Insights & Updates** → `/insights`; no Promotions link.
2. Adviser nav shows **Insights Authoring** → `/advisor/insights`; no Promotions link.
3. Admin Communications workspace links to **Legacy Promotions Migration**.

---

## 9. Storage retention

1. Confirm `promotion-assets` bucket exists in Supabase dashboard.
2. **Expect:** No migration or retirement script deleted bucket or objects.
3. Upload API returns 410 — no new objects from product UI.

---

## 10. Phase 9F.3 / replacement regression

1. Binder export generate/publish/withdraw for assigned client — unaffected.
2. Client `/insights` feed loads governed content.
3. Adviser `/advisor/insights` draft creation works.
4. Admin `/admin/communications` approval workflow works.

---

## 11. Production spot-check (post-deploy)

| Check | Production expect |
|-------|-------------------|
| `/advisor/promotions` redirect | Pass |
| `/api/promotions` retired payload | Pass |
| `promotions` table count | **0** |
| `legacy_promotions_write` | **false** |
| Migrate POST | **403** runtime gate (or no rows to migrate) |

---

## Automated regression (optional)

```bash
npm run qa:phase9f4-audit
npm run qa:phase9f4-write-freeze
npm run qa:phase9f4-migration-review
```

Runtime concurrency acceptance (staging only, not required for CP4 deploy):

```bash
npm run test:phase9f4-migration-idempotency-local
```

# Phase 6F — Performance, Security & Reliability Audit Report

**Date:** 13 June 2026  
**Scope:** Full-application audit after Phases 6C–6E (My Adviser, Google Calendar booking, My Clients workspace)  
**Principle:** Reliability and security over synthetic benchmark scores.

---

## 1. Baseline measurements (before changes)

Captured from production build (`.phase6f-baseline-build.log`):

| Metric | Baseline |
|--------|----------|
| Production build | ~44s wall clock (compile ~11.5s, TypeScript ~24.8s) |
| App routes | 80+ dynamic handlers |
| Dead chart dependency | `recharts` imported only by unused `ShieldRadarChart.tsx` |
| Error boundaries | None (`error.tsx` missing) |
| Google Calendar HTTP | Raw `fetch` without timeout |
| Client command-center | Single request loading all panels |
| DB indexes (6E paths) | No dedicated index on `adviser_feedback (client_id, created_at)` |

**Major routes reviewed:** dashboard, discover, shield-diagnostic, budget-optimiser, promotions, my-adviser, document-vault, advisor OS, my-clients, protection report, feedback, admin.

---

## 2. Bottlenecks found

### Frontend
- **Unused `recharts` bundle** — only referenced by dead `ShieldRadarChart` component.
- **Shield Architecture on dashboard** — statically imported; circular shield chart is heavy client JS.
- **No route error boundaries** — unhandled render errors could blank entire app shell.

### API / database
- **Client workspace command-center** — loaded workspace, review, file quality, task suggestions, tasks, and notes in one round-trip before first paint.
- **My Clients list aggregates** — feedback status queries benefit from `(client_id, created_at DESC)` index.
- **Paginated client list** — `advisor_user_id + display_name` ordering without supporting index.

### Reliability
- **Google Calendar API** — no abort timeout; hung Google responses could tie up server workers.
- **External service failures** — limited user-facing recovery on adviser/client route errors.

### Security (review — no weakening)
- Phases 6C–6E patterns confirmed: server-derived adviser/client IDs, encrypted OAuth tokens, `requireAdvisorAccess()` on adviser APIs, RLS-aligned access resolver.
- No service-role keys or Google secrets in client bundles (verified by existing security scripts).

---

## 3. Changes made

| Area | Change |
|------|--------|
| **Dead code** | Removed `ShieldRadarChart.tsx`; dropped `recharts` from `package.json` |
| **Dashboard** | `ShieldArchitectureModule` lazy-loaded via `next/dynamic` (`ssr: false`) |
| **Error boundaries** | Added `app/error.tsx`, `app/advisor/error.tsx`, `app/my-adviser/error.tsx` + shared `RouteErrorFallback` |
| **Google Calendar** | All Google HTTP calls use `lib/server/fetchWithTimeout.ts` (15s default) |
| **Client workspace** | Split command-center into **shell** (workspace + review) and **heavy** (file quality, suggestions, tasks, notes); UI loads shell first, heavy in background |
| **Database** | Migration `202606100021_phase6f_performance_indexes.sql` |
| **Validation** | `scripts/run-phase6f-audit.ts` + `npm run qa:phase6f` |

### Migration `202606100021`

```sql
idx_adviser_feedback_client_created  ON adviser_feedback (client_id, created_at DESC)
idx_clients_advisor_display_name     ON clients (advisor_user_id, display_name)
idx_discover_profiles_client_current ON discover_profiles (client_id) WHERE is_current = true
```

**Manual step:** Apply migration in Supabase before expecting index benefits in production.

---

## 4. Security findings

| Finding | Severity | Status |
|---------|----------|--------|
| OAuth tokens encrypted server-side; never returned to browser | — | ✅ Unchanged (6D) |
| Client cannot supply arbitrary adviser ID on My Adviser / booking | — | ✅ Unchanged (6C/6D) |
| Adviser client access via `resolveAccessibleClient` + RLS | — | ✅ Unchanged (6E) |
| Service-role imports confined to server scripts | — | ✅ `security:service-role` |
| API auth patterns on sensitive routes | — | ✅ `security:api` |
| Rate limiting on command-center endpoints | — | ✅ Existing `rateLimitOrThrow` |
| `fetchWithTimeout` does not log tokens or response bodies | — | ✅ New helper is transport-only |

**No auth, RLS, or role gates were weakened for performance.**

---

## 5. Reliability findings

| Improvement | Detail |
|-------------|--------|
| Route error boundaries | Users see recovery UI (Try again / safe navigation) without forced sign-out |
| Google API timeouts | 15s abort prevents indefinite hangs; callers surface public error messages |
| Staged command-center | Overview tab usable while heavy panels load; failures degrade per-section |
| Section-level error fields | `reviewError`, `tasksError`, etc. preserved — partial data still shown |

**Existing reliability retained:** booking idempotency, OAuth state validation, encrypted token storage, health endpoints (`/api/health/app`).

---

## 6. Performance budgets (regression guards)

| Budget | Target |
|--------|--------|
| Production build | < 60s on developer machine |
| Dashboard initial JS | Shield architecture not in main chunk (lazy) |
| Removed dependency weight | `recharts` not in lockfile |
| My Clients pagination | 20 rows/page (unchanged) |
| Command-center shell | ≤ 2 serial DB sections (workspace → review) |
| Google API timeout | 15s default |
| Booking availability | Not cached across users (unchanged) |

---

## 7. Before / after measurements

| Metric | Before | After |
|--------|--------|-------|
| `recharts` in dependencies | Yes | **Removed** |
| `ShieldRadarChart` | Present, unused | **Deleted** |
| Dashboard shield module | Static import | **Dynamic import** |
| `error.tsx` routes | 0 | **3** |
| Google `fetch` timeout | None | **15s** |
| Client CC API calls on load | 1 (full) | **2 staged** (shell → heavy) |
| Performance indexes | — | **3 new** |

**After build:** `.phase6f-after-build.log`

| Sub-step | Before | After |
|----------|--------|-------|
| Turbopack compile | 11.5s | **11.2s** |
| TypeScript | 24.8s | **23.1s** |
| Static page generation | 871ms | **440ms** |
| npm packages (audit) | 434 | **395** (−39 with `recharts` tree) |

---

## 8. Remaining risks

1. **Migration not applied** — indexes are no-ops until `202606100021` runs in Supabase.
2. **Heavy command-center still re-checks workspace access** — intentional security duplicate; minor latency cost.
3. **Lighthouse / Web Vitals** — not run in CI; recommend periodic manual check on dashboard and My Adviser mobile.
4. **Parent lockfile warning** — Next.js detected `C:\Users\User\package-lock.json`; consider `turbopack.root` in `next.config.ts` or removing stray lockfile.
5. **Middleware deprecation** — Next.js 16 warns to migrate `middleware` → `proxy` (pre-existing).

---

## 9. Rollback guidance

| Change | Rollback |
|--------|----------|
| Migration `202606100021` | `DROP INDEX IF EXISTS` for the three indexes (safe; no data loss) |
| `recharts` removal | `npm install recharts` and restore `ShieldRadarChart.tsx` if needed |
| Dynamic shield import | Revert `DashboardClient.tsx` to static import |
| Command-center split | Point workspace back to full `loadAdvisorClientCommandCenter`; remove `/heavy` route |
| `fetchWithTimeout` | Revert `calendarClient.ts` to raw `fetch` |
| Error boundaries | Delete `app/error.tsx`, `app/advisor/error.tsx`, `app/my-adviser/error.tsx` |

All rollbacks are independent; no cross-feature coupling.

---

## 10. Validation commands

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run qa:phase6f
npm run security:audit
npm run final:check
```

Phase-specific:

```bash
npm run qa:my-adviser
npm run qa:calendar
npm run qa:my-clients
```

---

**Phase 6F complete.** No further feature work in this phase.

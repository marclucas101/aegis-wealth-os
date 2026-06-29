# CRM V2 — Phase 01 Shell Architecture

**Phase:** 01 — Foundation shell and pilot gating  
**Branch:** `crm-v2-01-shell`  
**Entry route:** `/advisor-v2`

---

## Purpose

Phase 01 delivers a parallel, disabled-by-default adviser CRM V2 shell at `/advisor-v2`. The shell provides layout, navigation, access gating, loading and error boundaries, and placeholder module pages. It deliberately loads **no CRM business data** and performs **no source writes**.

Legacy adviser workflows remain at `/advisor` unchanged.

---

## Route table

| Route | Purpose | Business data read | Write capability |
| ----- | ------- | -----------------: | ---------------: |
| `/advisor-v2` | Foundation landing — domain pillars and module links | No | No |
| `/advisor-v2/relationships` | Phase 02 placeholder — Relationship workspace | No | No |
| `/advisor-v2/appointments` | Phase 03 placeholder — Appointment workflow | No | No |
| `/advisor-v2/service` | Phase 06 placeholder — Servicing and commitments | No | No |
| `/advisor-v2/communications` | Phase 10 placeholder — CRM communications bridge | No | No |
| `/advisor-v2/reports` | Phase 12 placeholder — Adviser reports | No | No |
| `/advisor-v2/operations` | Phase 12 placeholder — Operator diagnostics | No | No |
| `/advisor-v2/templates` | Phase 10 placeholder — Communication templates | No | No |
| `/advisor-v2/settings` | Phase 01 placeholder — links to `/advisor/my-profile` only | No | No |
| `GET /api/advisor-v2/shell` | Safe gate probe — `available` + `requestId` only | No | No |

Every Phase 01 route shows **Business data read: No** and **Write capability: No**.

---

## Layout hierarchy

```text
app/advisor-v2/
  layout.tsx          → assertCrmV2Access() → shell or denial
  loading.tsx         → CrmV2LoadingSkeleton (route loading boundary)
  error.tsx           → RouteErrorFallback (route error boundary)
  page.tsx            → foundation landing
  relationships/page.tsx
  appointments/page.tsx
  service/page.tsx
  communications/page.tsx
  reports/page.tsx
  operations/page.tsx
  templates/page.tsx
  settings/page.tsx

app/api/advisor-v2/
  shell/route.ts      → GET gate probe
```

**Layout flow:**

1. `app/advisor-v2/layout.tsx` is a server component with `dynamic = "force-dynamic"` and `revalidate = 0`.
2. On every request it awaits `assertCrmV2Access()` from `lib/crm-v2/access.ts`.
3. If denied:
   - `unauthenticated` or `forbidden` → `AuthenticatedAppShell` + `AdvisorAccessDenied` (existing adviser convention).
   - All CRM-specific denial reasons → `AuthenticatedAppShell` + `CrmV2AccessDenied` (generic message).
4. If allowed → `AdviserCrmV2Shell` wraps `{children}`.

Child routes inherit the layout guard. Direct navigation to any `/advisor-v2/*` path runs the same centralized evaluation — there is no UI-only authorization.

---

## Centralized access evaluation

| Module | Role |
|--------|------|
| `lib/crm-v2/constants.ts` | Approved feature keys and env variable name |
| `lib/crm-v2/pilotConfig.ts` | Parse `CRM_V2_PILOT_USER_IDS` (fail-closed) |
| `lib/crm-v2/access.ts` | `assertCrmV2Access()` — single gate for layout and shell API |
| `lib/crm-v2/navigation.ts` | CRM V2 nav config (decoupled from legacy `lib/navigation.ts`) |

**Access sequence** (implemented order in `assertCrmV2Access`):

```text
1. requireAdvisorAccess()     — session auth + adviser role
2. isFeatureEnabled('crm_v2_master')
3. isFeatureEnabled('crm_v2_pilot_mode')
4. parsePilotAllowlistFromEnv()
5. isUserInPilotAllowlist(auth user id)
```

---

## Desktop navigation

`AdviserCrmV2Shell` (`components/aegis/advisor-v2/AdviserCrmV2Shell.tsx`) renders:

- Fixed left sidebar (`lg:static`, 16rem) visible at `lg` breakpoint and above.
- Primary nav from `CRM_V2_PRIMARY_NAV`: Today, Relationships, Appointments, Service, Communications.
- Collapsible **More** submenu from `CRM_V2_MORE_NAV`: Reports, Operations, Templates, Settings.
- Sticky header with resolved page title.
- `AuthStatus` in sidebar footer and header (desktop).

Nav links use `isCrmV2NavActive(pathname, href)` for active-state detection.

---

## Mobile navigation

- Hamburger toggle (`Open navigation` / `Close navigation`) visible below `lg`.
- Sidebar slides in from the left with backdrop overlay.
- `Escape` key closes the menu; body scroll is locked while open.
- Tapping a nav link closes the mobile menu via `onNavigate`.
- Same primary + More structure as desktop.

---

## Active-route behavior

`isCrmV2NavActive` in `lib/crm-v2/navigation.ts`:

- Landing `/advisor-v2` is active only on exact match (not child paths).
- Other routes match exact href or `href/` prefix (future-proof for Phase 02+ detail routes).
- Active links receive `aria-current="page"` and highlighted styles.
- More submenu button highlights when any More child route is active.

---

## Loading boundary

`app/advisor-v2/loading.tsx` renders `CrmV2LoadingSkeleton` — a static skeleton with no data placeholders, no fetch calls, and no business identifiers.

---

## Error boundary

`app/advisor-v2/error.tsx`:

- Uses `RouteErrorFallback` with title **CRM V2 unavailable**.
- Does **not** render `{error.message}` or stack traces.
- Logs only `digest` and `name` to console — no allowlist or PII.
- Shows optional `Reference: {digest}` when Next.js provides a digest.
- Link back to `/advisor`.

---

## Shared shell components

| Component | File | Purpose |
|-----------|------|---------|
| `AdviserCrmV2Shell` | `components/aegis/advisor-v2/AdviserCrmV2Shell.tsx` | CRM layout, desktop + mobile nav, landmarks |
| `CrmV2PageHeader` | `CrmV2PageHeader.tsx` | Page title, subtitle, phase badge |
| `CrmV2SectionPanel` | `CrmV2SectionPanel.tsx` | Content panel wrapper |
| `CrmV2FoundationEmptyState` | `CrmV2FoundationEmptyState.tsx` | Module placeholder messaging |
| `CrmV2FoundationPlaceholderPage` | `CrmV2FoundationPlaceholderPage.tsx` | Standard placeholder page wrapper |
| `CrmV2PhaseNotice` | `CrmV2PhaseNotice.tsx` | Foundation status notice (landing only) |
| `CrmV2AccessDenied` | `CrmV2AccessDenied.tsx` | Generic CRM denial — no allowlist disclosure |
| `CrmV2LoadingSkeleton` | `CrmV2LoadingSkeleton.tsx` | Route loading skeleton |

---

## Placeholder-page strategy

- Module pages use `CrmV2FoundationPlaceholderPage` with phase-specific messages (e.g. Relationships → Phase 02).
- Landing page references `CRM_V2_DOMAIN_PILLARS` (Relationship, Engagement, Advice, Service) without numeric counts or fake data.
- No `fetch()`, `useEffect` data loads, Supabase clients, or business API calls in any page or shell component.
- Settings links out to existing `/advisor/my-profile` — no CRM settings persistence.

---

## Why no business data is loaded

Phase 01 establishes the shell, gating, and navigation only. Relationship, appointment, service, and communications sources do not yet exist in the CRM V2 namespace. Loading business data would:

- Violate Phase 01 scope (no business APIs, no client-data reads).
- Create misleading UI before authoritative sources are defined in Phases 02+.
- Expand the attack surface before domain security boundaries are implemented.

The access gate itself reads only session identity (via `requireAdvisorAccess`) and feature-control rows (via `isFeatureEnabled`). Pilot membership is evaluated from server environment configuration.

---

## Why `/advisor` remains unchanged

- Legacy adviser portal layout (`app/advisor/layout.tsx`) still uses `requireAdvisorAccess()` only — no CRM V2 imports.
- `lib/navigation.ts` contains no `/advisor-v2` links.
- Advisers continue using `/advisor` for all production workflows during foundation rollout.
- CRM V2 is a parallel route tree, not a replacement, until Phase 14 cutover.

---

## Why there are no relationship or appointment detail routes

- `app/advisor-v2/relationships/[id]` and `app/advisor-v2/appointments/[id]` are **not created** in Phase 01.
- Relationship 360 requires Phase 02 schema/API design and read-first implementation.
- Appointment lifecycle requires Phase 03 migration and state machine.
- Placeholder list routes exist only to validate shell navigation and module boundaries.

---

## Shell-status route (`GET /api/advisor-v2/shell`)

**Purpose:** A narrow, server-side probe that returns only whether the current session may access the CRM V2 shell.

**Response body:**

```json
{ "available": true|false, "requestId": "crm2_..." }
```

**Why it exists:**

- Allows operators and integration tests to verify gating without scraping HTML.
- Establishes the `X-Request-Id` + `Cache-Control: no-store` pattern for future V2 APIs.
- Confirms layout-level guard behavior for API consumers.

**Protection:**

- Calls the same `assertCrmV2Access()` as the layout.
- Returns `401` for unauthenticated, `403` for all other denials, `200` when allowed.
- Does **not** include `reason`, allowlist, pilot IDs, or feature-flag details in the JSON body.
- Sets `X-Request-Id` header mirroring the body `requestId`.
- `force-dynamic` — no static caching.

**Why it does not reveal pilot eligibility or business information:**

- Denied responses are indistinguishable in body shape (`available: false` only).
- No user IDs, allowlist tokens, or flag states are returned.
- No database queries beyond existing feature-control lookup used by `isFeatureEnabled`.
- Request IDs are opaque correlation tokens, not identity.

---

## Migration (feature controls only)

`202606290001_phase01_crm_v2_feature_controls.sql` — idempotent `INSERT` for `crm_v2_master` and `crm_v2_pilot_mode` (both `enabled: false`). **Not applied** until operator approval.

---

## Legacy compatibility

- Client portal routes unchanged.
- Phase 10.2 work queue not imported by CRM V2 shell.
- Phase 9F.4 promotions observation unchanged (`legacy_promotions_write` stays false).

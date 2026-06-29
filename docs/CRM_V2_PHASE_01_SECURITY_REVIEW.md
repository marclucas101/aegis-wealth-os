# CRM V2 — Phase 01 Security Review

**Phase:** 01  
**Branch:** `crm-v2-01-shell`  
**Scope:** Foundation shell and pilot gating only

---

## Review summary

The Phase 01 implementation was reviewed against the actual code in `lib/crm-v2/*`, `app/advisor-v2/*`, `app/api/advisor-v2/shell/route.ts`, and supporting compliance/auth modules. No unresolved security defects were identified.

---

## Control inventory

### Server-only access evaluation

| Control | Implementation | Status |
|---------|----------------|--------|
| Server-only modules | `import "server-only"` in `access.ts`, `pilotConfig.ts` | Pass |
| Centralized guard | `assertCrmV2Access()` — single entry for layout + shell API | Pass |
| No client-side gate | Layout evaluates on server; shell is client UI only after guard passes | Pass |

### Authentication

| Control | Implementation | Status |
|---------|----------------|--------|
| Session source | `supabase.auth.getUser()` via `requireAuthenticatedUser()` | Pass |
| Unauthenticated handling | `unauthenticated` → `AdvisorAccessDenied` in layout; `401` on shell API | Pass |

### Role enforcement

| Control | Implementation | Status |
|---------|----------------|--------|
| Adviser-only | `isAdvisorRole()` in `requireAdvisorAccess()` | Pass |
| Client denial | `forbidden` for non-adviser roles | Pass |
| No browser adviser ID | Identity from `adviserAccess.authUser.id` only; no `searchParams` | Pass |

### Master gate

| Control | Implementation | Status |
|---------|----------------|--------|
| Key | `crm_v2_master` | Pass |
| Fail-closed default | `enabled: false` in `FEATURE_DEFAULTS` and migration seed | Pass |
| DB failure | `loadFeatureControls()` uses code defaults on error | Pass |

### Pilot gate

| Control | Implementation | Status |
|---------|----------------|--------|
| Separate flag | `crm_v2_pilot_mode` — required in addition to master | Pass |
| Env allowlist | `CRM_V2_PILOT_USER_IDS` parsed server-side | Pass |
| Malformed config | Entire allowlist rejected | Pass |
| Missing/empty config | Deny all | Pass |

### Admin handling

| Control | Implementation | Status |
|---------|----------------|--------|
| No admin bypass | No `isAdminRole`, `requireAdminAccess`, or `isAdmin` in `access.ts` | Pass |
| Admin non-adviser | Treated as `forbidden` at adviser gate | Pass |

### Route inheritance

| Control | Implementation | Status |
|---------|----------------|--------|
| Layout-level guard | `app/advisor-v2/layout.tsx` awaits `assertCrmV2Access()` | Pass |
| Direct child route access | All pages inherit layout — no per-page bypass | Pass |
| Shell API | Same `assertCrmV2Access()` | Pass |

### No UI-only authorization

Denied users never receive `AdviserCrmV2Shell` or placeholder page content. Denial is decided server-side before render.

### Feature lookup fail-closed

`isFeatureEnabled()` returns `FEATURE_DEFAULTS[featureKey].enabled` when row missing. CRM V2 defaults are `false`.

### Environment parsing

`parsePilotAllowlistFromEnv()` validates every token against UUID regex. One malformed token rejects the entire list.

### Allowlist confidentiality

- Not in UI (`CrmV2AccessDenied` — no "allowlist", "pilot user", or UUIDs).
- Not in shell API JSON body.
- Not in error boundary output.
- Not hardcoded in `lib/crm-v2/*` source.

### Request-ID handling

- Generated server-side: `crm2_{timestamp}_{random}` in `createShellRequestId()`.
- Returned in shell API body and `X-Request-Id` header.
- Opaque correlation token — not a user identifier.

### Shell-status response minimization

`GET /api/advisor-v2/shell` returns only `{ available, requestId }`. No `reason`, flags, or allowlist fields.

### Safe logging

- `error.tsx` logs `{ digest, name }` only.
- Feature flag DB errors log message string without payloads.
- Pilot parse does not log env token values.

### Error redaction

- `RouteErrorFallback` — no `{error.message}` in JSX.
- Safe title: "CRM V2 unavailable".

### No client-data reads

- `access.ts` has no Supabase client, `loadDashboard`, or financial references.
- Placeholder pages have no `fetch()`.
- Shell API has no `from()` queries.

### No source writes

No INSERT/UPDATE/DELETE in CRM V2 routes or access modules.

### No service-role expansion

CRM V2 adds no new service-role API routes. `isFeatureEnabled` uses existing `loadFeatureControlsFromDb` (pre-existing compliance pattern).

### No adviser impersonation

No admin override path. Identity strictly from authenticated session.

### No open redirect

Denial and error links target fixed internal paths: `/advisor`, `/dashboard`.

### No cookie/token disclosure

Shell API and error handling do not echo session tokens or cookies.

---

## Threat table

| Threat | Control | Residual risk |
| -------------------------- | ------------------------ | ------------- |
| Client opens `/advisor-v2` | Server role guard (`requireAdvisorAccess` → `forbidden`) | Low |
| Adviser bypasses pilot UI | Server pilot guard (flags + env allowlist before shell render) | Low |
| Malformed pilot config | Fail closed (`parsePilotAllowlistFromEnv` → `malformed`) | Low |
| Feature lookup fails | Fail closed (code defaults `enabled: false`) | Low |
| Allowlist exposed in logs | Redacted/no-list logging | Low |
| Direct child route access | Layout-level guard on all `/advisor-v2/*` | Low |
| Admin accesses CRM V2 without adviser role | `forbidden` at step 1 — no bypass | Low |
| Unauthenticated API probe | `401` on shell route | Low |
| Eligibility oracle via API | Same body shape for all denials (`available: false`) | Low |
| Stale feature-flag cache widens access | 30s TTL; defaults false; pilot still requires env allowlist | Low |

---

## Phase 9F.4

- No Promotions Stage 6 work.
- `legacy_promotions_write` unchanged.
- No changes to governed content or promotions schema.

---

## Verdict

Phase 01 shell meets fail-closed gating requirements for controlled pilot. Business-domain security (assignment scope, IDOR, DTO minimization) is deferred to Phases 02+.

**No unresolved security defects** — Phase 01 is ready for operator review of foundation-control migration apply.

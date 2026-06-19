# Phase 9A — Publication Workflow

## Schema decision

**Chosen approach:** One generic `published_outputs` table with `safe_payload` JSONB.

### Alternatives considered

| Approach | Why not chosen |
|----------|----------------|
| Publication fields on each snapshot table (`shield_scores`, `annual_reviews`, …) | Invasive; couples compliance lifecycle to scoring schema; harder to supersede across output types |
| Common publication table + domain tables | More normalised but requires dual joins for every client read; premature for Phase 9A |
| **Generic `published_outputs`** | Minimally invasive; single query for current published output; safe payload enforced at application layer; internal analysis stays in existing tables |

**Safety rule:** `published_outputs.safe_payload` stores **allowlisted client-safe fields only**. Raw internal analysis is never copied into this column.

---

## Lifecycle states

```
draft → adviser_reviewed → published
                              ↓
                    superseded / expired / withdrawn
```

| Status | Client visible | Notes |
|--------|----------------|-------|
| `draft` | No | Adviser preparation |
| `adviser_reviewed` | No | Review gate passed |
| `published` | Yes (if not expired/superseded/withdrawn) | Current client summary |
| `superseded` | No | Replaced by newer publication |
| `expired` | No | Past `expires_at` |
| `withdrawn` | No | Admin/adviser withdrawal |

---

## API endpoints

| Method | Route | Actor | Action |
|--------|-------|-------|--------|
| GET | `/api/advisor/clients/[clientId]/publications` | Assigned adviser / admin | List outputs |
| POST | `/api/advisor/clients/[clientId]/publications` | Assigned adviser / admin | Prepare safe output |
| POST | `.../publications/[outputId]/review` | Assigned adviser / admin | Mark adviser_reviewed |
| POST | `.../publications/[outputId]/publish` | Assigned adviser / admin | Publish (supersedes prior) |
| POST | `.../publications/[outputId]/withdraw` | Assigned adviser / admin | Withdraw |

## Publishing requirements

1. Adviser or admin authentication
2. Current client assignment (admin bypass)
3. Valid safe payload (allowlist validation)
4. Recorded `algorithm_version` and `source_input_version`
5. Audit log entry

Clients **cannot** publish or approve their own outputs.

---

## Implementation modules

| Module | Path |
|--------|------|
| Workflow | `lib/compliance/publicationWorkflow.ts` |
| Safe DTO builder | `lib/compliance/clientSafeDtos.ts` |
| Access gate | `lib/compliance/clientAccessGate.ts` |

---

## Client read path

1. Client calls `GET /api/dashboard/current`
2. Server resolves relationship stage + entitlements + feature control
3. `loadCurrentPublishedOutput()` applies **all** visibility rules:
   - `output_audience = client_published`
   - `publication_status = published`
   - `withdrawn_at IS NULL`
   - `superseded_at IS NULL`
   - `expires_at` null or in the future
   - `isCurrentPublishedOutput()` re-validates in application layer
4. If qualifying published output exists → `accessMode: "published"` with sanitized allowlisted payload
5. Else → `accessMode: "fallback"` — **never** auto-generated personalised snapshot
6. Never return raw `DashboardSnapshot` to `role=client`

### Publication visibility by lifecycle state

| State | Client API | Adviser API | Notes |
|-------|------------|-------------|-------|
| No publication | Fallback envelope | Internal analysis via Phase 8C | Default production path |
| `draft` | Not visible | Visible in publications list | Prepare only |
| `adviser_reviewed` | Not visible | Visible; publishable | Must pass `adviser_reviewed` before publish |
| `published` (current) | Visible if feature enabled + RLS passes | Visible | Single current row enforced by partial unique index |
| `expired` | Not visible | Visible in history | `expires_at` in past |
| `withdrawn` | Not visible | Visible with withdrawal reason | Terminal state |
| `superseded` | Not visible | Visible in history | Replaced by newer publication |

Publishing requires `adviser_reviewed` status (draft → review → publish). Direct draft-to-publish is **not** permitted after Phase 9A hardening.

---

## Audit events

- `publication_prepared`
- `publication_reviewed`
- `publication_published`
- `publication_superseded`
- `publication_withdrawn`
- `publication_expired`
- `client_viewed_published_output`

Metadata only — no full financial payloads in audit rows.

---

## Phase 9C+ deferrals

- Premium publishing UI
- Meeting presentation audience UI
- Bulk publish / template library

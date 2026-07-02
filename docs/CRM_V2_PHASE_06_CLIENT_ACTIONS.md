# CRM V2 Phase 06 — Client Actions and Requests

**Feature key:** `crm_v2_client_service` (default disabled, `client_visible = true` when enabled)

---

## 1. Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/actions` | `app/actions/page.tsx` + `ClientActionsClient.tsx` | Client-owned and shared commitments, document requests |
| `/requests` | `app/requests/page.tsx` + `ClientRequestsClient.tsx` | List and submit service requests |
| `/requests/[requestId]` | `app/requests/[requestId]/page.tsx` | Request detail, respond, cancel |

All routes fail closed when feature disabled — safe message, no data leak.

---

## 2. Actions view (`/actions`)

**Shows:**

- Client-owned commitments (`owner = client`, `client_visible = true`)
- Shared commitments (`owner = shared`, `client_visible = true`)
- Document requests (`commitment_type = document_request`, visible)
- Client-visible appointment follow-up items (when explicitly flagged)

**Does not show:**

- Adviser-only commitments
- `advisor_tasks`
- Internal review workflow
- Private adviser notes (`internal_note`)
- Work-queue priority or blocking metadata
- Other clients' records
- Financial data, policy IDs, storage paths

**API:** `GET /api/actions`  
**Updates:** `PATCH /api/actions/[commitmentId]` with `toStatus`, `version`

Client may complete only when `canComplete === true` (owner client or shared).

---

## 3. Requests view (`/requests`)

**Client may:**

- Submit allowlisted category + bounded summary/details
- View status via safe `clientVisibleStatus` label
- Open detail at `/requests/[requestId]`
- Respond when `canRespond === true` (`waiting_on_client`)
- Cancel when `canCancel === true` (`submitted` only)
- View `resolutionSummary` when resolved

**Client may not:**

- Select arbitrary adviser (derived from `clients.advisor_user_id`)
- Submit product orders or emergency-service categories
- Mark request resolved or closed
- Edit original submission after submit
- Access other clients' request IDs

**APIs:**

- `GET/POST /api/requests`
- `GET /api/requests/[requestId]`
- `POST /api/requests/[requestId]/respond`
- `POST /api/requests/[requestId]/cancel`

---

## 4. Single authority, dual projection

The same `service_commitments` and `client_service_requests` rows power:

- Adviser Service workspace (`/advisor-v2/service`)
- Client Actions/Requests (`/actions`, `/requests`)
- Relationship 360 Service tab (bounded projection)
- Work queue (read-only adapter)

DTO shaping is server-side — client components never receive adviser-only fields.

---

## 5. Navigation conventions

- Additive client routes only — no rewrites of `/dashboard`, `/appointments`, `/my-plan`
- Document upload from document requests links to existing `/document-vault` flow
- No storage paths or signed URLs in UI

---

## 6. Notifications (client-visible)

In-app only via `client_notifications`:

- Request submitted, acknowledged, information requested, resolved
- Client commitment assigned, due soon
- Document requested/received

Gated by existing `client_in_app_notifications` preference where applicable. No email/SMS/WhatsApp in Phase 06.

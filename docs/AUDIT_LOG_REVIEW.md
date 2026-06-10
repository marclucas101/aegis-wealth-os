# Audit Log Review — Phase 4W

**Date:** 2026-06-10  
**Purpose:** How to review `audit_logs` for compliance, debugging, and suspicious activity detection.

**Related:** [Operations Runbook](./OPERATIONS_RUNBOOK.md) · [Security Test Plan](./SECURITY_TEST_PLAN.md) · [Supabase Security Review](./SUPABASE_SECURITY_REVIEW.md)

---

## 1. Table overview

`audit_logs` is append-only, written server-side via `writeAuditLog()` (`lib/supabase/auditLog.ts`) using the service role. Authenticated users **cannot** read audit rows through the app UI in Phase 4W — review via Supabase SQL editor or dashboard with admin credentials.

| Column | Description |
|--------|-------------|
| `id` | UUID primary key |
| `client_id` | Related client (nullable) |
| `user_id` | Actor in `public.users` (nullable) |
| `action` | Stable action string (see §2) |
| `entity_type` | Table or domain entity |
| `entity_id` | Related entity UUID (nullable) |
| `metadata` | JSONB context (ids, statuses — no secrets by design) |
| `ip_address` | Request IP when captured |
| `user_agent` | Browser/client UA when captured |
| `created_at` | Event timestamp (UTC) |

Audit insert failures are logged to server stdout and **do not** fail the user request.

---

## 2. Important audit actions

### Client data writes

| Action | Route / source |
|--------|----------------|
| `discover_profile_saved` | `POST /api/discover/save` |
| `document_uploaded` | `POST /api/documents/upload` |
| `document_deleted` | `POST /api/documents/delete` |
| `roadmap_status_updated` | `POST /api/roadmap/status` |
| `stress_test_run` | `POST /api/stress-testing/run` |
| `wealth_blueprint_saved` | `POST /api/wealth-blueprint/save` |
| `annual_review_saved` | `POST /api/annual-review/save` |

### Advisor actions

| Action | Route / source |
|--------|----------------|
| `advisor_note_created` | Advisor notes POST |
| `advisor_note_updated` | Advisor notes PATCH |
| `advisor_note_deleted` | Advisor notes DELETE |
| `advisor_task_created` | Advisor tasks POST |
| `advisor_task_updated` | Advisor tasks PATCH (status changes may use specific action) |
| `advisor_suggested_task_created` | Task suggestion → task |
| `advisor_document_uploaded` | Advisor document upload |
| `advisor_document_deleted` | Advisor document delete |
| `advisor_document_accessed` | Signed URL access |
| `advisor_wealth_blueprint_viewed` | Report view |
| `advisor_annual_review_viewed` | Report view |
| `client_review_status_updated` | Review pipeline |
| `client_invitation_created` | Advisor invite |
| `client_invitation_failed` | Advisor invite failure |
| `client_placeholder_created` | Placeholder client |

### Admin actions

| Action | Route / source |
|--------|----------------|
| `user_role_updated` | Admin role change |
| `client_advisor_assigned` | Admin advisor assignment |
| `client_advisor_unassigned` | Admin unassign |
| `client_invitation_created` | Admin invite |
| `client_invitation_failed` | Admin invite failure |

### Onboarding

| Action | Source |
|--------|--------|
| `client_placeholder_linked_to_user` | User profile linking |

---

## 3. Sample SQL queries

Run in Supabase **SQL Editor** (service role / dashboard admin — not exposed to app users).

### Recent activity (last 24 hours)

```sql
SELECT created_at, action, user_id, client_id, entity_type, entity_id
FROM audit_logs
WHERE created_at >= now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 100;
```

### Actions for a specific client

```sql
SELECT created_at, action, user_id, metadata, ip_address
FROM audit_logs
WHERE client_id = '<client-uuid>'
ORDER BY created_at DESC
LIMIT 50;
```

### Admin role changes

```sql
SELECT created_at, user_id, metadata, ip_address
FROM audit_logs
WHERE action = 'user_role_updated'
ORDER BY created_at DESC
LIMIT 20;
```

### Document access and uploads

```sql
SELECT created_at, action, user_id, client_id, entity_id, metadata
FROM audit_logs
WHERE action IN (
  'document_uploaded',
  'document_deleted',
  'advisor_document_uploaded',
  'advisor_document_deleted',
  'advisor_document_accessed'
)
AND created_at >= now() - interval '7 days'
ORDER BY created_at DESC;
```

### Failed invitations

```sql
SELECT created_at, user_id, metadata, ip_address
FROM audit_logs
WHERE action = 'client_invitation_failed'
ORDER BY created_at DESC
LIMIT 20;
```

### Volume by action (weekly)

```sql
SELECT action, count(*) AS event_count
FROM audit_logs
WHERE created_at >= now() - interval '7 days'
GROUP BY action
ORDER BY event_count DESC;
```

---

## 4. Review cadence

| Cadence | Reviewer | Focus |
|---------|----------|-------|
| **Daily** (beta) | On-call / lead dev | Error-adjacent actions: invitation failures, spike in deletes |
| **Weekly** | Ops + compliance | Role changes, advisor assignments, document access patterns |
| **Monthly** | Security/compliance | Full volume report; compare to user growth |
| **Post-incident** | Incident lead | Time-window around incident; actor IPs and user_ids |

Cross-check server logs when audit rows are **missing** for an action that should have fired — search Vercel for `[auditLog]` or `Failed to write audit log`.

---

## 5. Suspicious activity examples

| Pattern | Why it matters | Investigate |
|---------|----------------|-------------|
| Many `user_role_updated` to `admin` in short window | Privilege escalation | Actor `user_id`, IP, metadata old/new roles |
| `advisor_document_accessed` burst from one IP | Possible scraping | User assignment legitimacy, IP geo |
| `document_deleted` spike | Data loss or abuse | Client scope, advisor assignment |
| `client_advisor_assigned` outside business hours | Unauthorized reassignment | Admin actor, client list |
| `client_invitation_failed` cluster | Auth/config issue or abuse | Metadata error reasons, rate limits |
| Actions with `user_id` null but sensitive `action` | Logging gap or bug | Server route auth guards |
| Same `ip_address` across many distinct `user_id` values | Shared network or credential sharing | Context-dependent |

Escalate to [Incident Response](./INCIDENT_RESPONSE.md) if evidence suggests breach or insider abuse.

---

## 6. Privacy and handling

- Audit rows may contain PII in `metadata` or `ip_address` — treat exports as confidential.
- Do not copy audit query results into public tickets without redaction.
- Retention policy: align with legal/compliance (not enforced in app schema for MVP — plan archival).

---

## 7. Review checklist

- [ ] SQL queries tested in staging
- [ ] Weekly review owner assigned
- [ ] Process to correlate missing audits with Vercel logs documented
- [ ] Suspicious patterns table shared with security contact
- [ ] Post-incident audit export procedure included in [Incident Response](./INCIDENT_RESPONSE.md)

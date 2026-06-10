# Storage Policy Review — Phase 4X

**Date:** 2026-06-10  
**Source:** `supabase/migrations/202606100010_storage_policies.sql`  
**Bucket:** `client-documents` (private)

**Related:** [RLS Policy Review](./RLS_POLICY_REVIEW.md) · [API Security Review](./API_SECURITY_REVIEW.md)

---

## Bucket / path model

| Property | Value |
|----------|-------|
| Bucket ID | `client-documents` |
| Public | `false` — no anonymous CDN access |
| Path convention | `{client_id}/{uuid}/{file_name}` |
| Max file size (bucket) | 50 MiB (Supabase bucket limit) |
| App upload limit | 10 MiB (`MAX_DOCUMENT_SIZE_BYTES` in API) |
| MIME types | Unrestricted at bucket level; API validates extension + MIME |

**Path parser:** `client_id_from_storage_path(name)` — first path segment must be valid UUID.

---

## Access model (storage.objects policies)

| Operation | Who | Policy |
|-----------|-----|--------|
| SELECT | Client owner | `owns_client(parsed_client_id)` |
| INSERT | Client owner | `owns_client(parsed_client_id)` |
| UPDATE | Client owner | `owns_client(parsed_client_id)` |
| DELETE | Assigned advisor or admin | `is_assigned_advisor(...)` or `is_admin()` |

### Important: `owns_client` includes assigned advisor

Because `owns_client()` returns true when `advisor_user_id = auth.uid()`, **assigned advisors** can SELECT/INSERT/UPDATE storage objects under their clients' prefixes via direct Supabase storage API — not only clients.

**Admins** without assignment: no storage RLS policy grants SELECT/INSERT/UPDATE. Admin document access goes through **API + service role** (`advisorDocumentPersistence`, `documentPersistence`).

---

## API vs storage RLS

| Actor | Upload path | Enforcement |
|-------|-------------|-------------|
| Client | `POST /api/documents/upload` | Session `client_id`; service role writes storage + `documents` row |
| Advisor | `POST /api/advisor/clients/[clientId]/documents/upload` | `resolveAccessibleClient()` then service role |
| Advisor delete | `POST .../documents/[documentId]/delete` | Assignment check + service role |
| Signed URL | Client or advisor POST routes | `fetchOwnedDocument` / advisor access check; short-lived URL |

Application uploads always use service role for storage operations, so storage RLS is a **secondary** control against direct browser storage SDK abuse.

---

## Signed URL behavior

| Route | Auth | Scope | Expiry | Audit |
|-------|------|-------|--------|-------|
| `POST /api/documents/signed-url` | Client session | Own documents only | ~120s | No |
| `POST /api/advisor/.../signed-url` | Advisor/admin | Assigned client docs | ~120s | `advisor_document_accessed` |

**Controls:**

- `document_id` validated; `client_id` never from body on client route
- Ownership verified before `createSignedUrl`
- URLs are time-limited; bucket remains private

**Gap (LOW):** Signed-url routes have no rate limit — authenticated abuse could generate many URLs. Consider light rate bucket.

---

## Archive / delete behavior

| Actor | API | Storage | `documents` row |
|-------|-----|---------|-----------------|
| Client | `POST /api/documents/delete` | Removed via service role | Archived/deleted per persistence logic |
| Advisor | `POST .../delete` | Service role after assignment check | Same |
| Direct RLS DELETE | — | Advisor assigned or admin only | N/A |

Clients cannot DELETE storage objects via RLS — they use API soft-delete/archive path.

---

## Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| No virus scanning on upload | Low | Deferred to scale |
| Bucket MIME allowlist is NULL | Low | API validates; bucket accepts all types |
| Admin storage access only via service role | Low | Acceptable; no direct admin browser upload to storage |
| Path traversal | Low | UUID prefix validation in `client_id_from_storage_path` |
| Cross-client path guess | Medium (mitigated) | UUID paths; RLS checks prefix ownership |
| Service role key compromise | High | Full storage access — same as DB |

---

## Manual tests

1. **Client A** cannot `storage.from('client-documents').list()` for client B's prefix.
2. **Unassigned advisor** cannot upload to assigned-other-advisor client prefix via storage SDK.
3. **Assigned advisor** can read client prefix (if using browser storage SDK) — expected per `owns_client`.
4. Signed URL expires and returns 403/404 after expiry.
5. Upload to malformed path (`not-a-uuid/foo`) fails RLS INSERT.

---

**Conclusion:** Storage policies align with client-owned prefixes and advisor-assigned delete. Primary access path is API + service role with explicit assignment checks. Admin and cross-tenant isolation depend on API guards, not storage SELECT policies.

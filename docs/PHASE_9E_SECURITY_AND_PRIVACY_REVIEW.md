# Phase 9E Security and Privacy Review

## API security inventory — Phase 9E routes

| Route | Methods | Auth | Rate limit | Audit | Notes |
|-------|---------|------|------------|-------|-------|
| `/api/client/insights` | GET | Active client + feature | N/A read | No | `CLIENT_API_CACHE_HEADERS` |
| `/api/client/insights/[contentId]` | GET, POST | Active client + feature | POST yes | POST view audit | No approval metadata in response |
| `/api/client/communication-preferences` | GET, PATCH | Active client | PATCH yes | PATCH yes | Session-scoped |
| `/api/client/notifications` | GET | Active client | N/A read | No | No provider metadata |
| `/api/client/notifications/[notificationId]` | PATCH | Active client | PATCH yes | PATCH yes | Client ID scoped |
| `/api/advisor/insights` | GET, POST | `requireAdvisorAccess` | POST yes | Workflow layer | Assignment on selected clients |
| `/api/advisor/insights/[contentId]` | GET, PATCH | `requireAdvisorAccess` | PATCH yes | Workflow layer | No self-approve |
| `/api/advisor/insights/[contentId]/submit` | POST | `requireAdvisorAccess` | POST yes | Workflow layer | |
| `/api/advisor/clients/[clientId]/binder-export` | POST | `requireAdvisorAccess` + assignment | POST yes | `binder_generated` in service | Manifest only |
| `/api/admin/communications` | GET | `requireAdminAccess` | N/A read | No | |
| `/api/admin/communications/[contentId]/approve` | POST | `requireAdminAccess` | POST yes | Workflow `content_approved` | |
| `/api/admin/communications/[contentId]/reject` | POST | `requireAdminAccess` | POST yes | Workflow `content_rejected` | Reason required |
| `/api/admin/communications/[contentId]/request-changes` | POST | `requireAdminAccess` | POST yes | Workflow `content_changes_requested` | |
| `/api/admin/communications/[contentId]/publish` | POST | `requireAdminAccess` | POST yes | Workflow `content_published` | Email async |
| `/api/admin/communications/[contentId]/withdraw` | POST | `requireAdminAccess` | POST yes | Workflow `content_withdrawn` | Cancels pending delivery |
| `/api/admin/communication-deliveries` | GET | `requireAdminAccess` | N/A read | No | Sanitized fields only |
| `/api/admin/promotions-migration` | GET, POST | `requireAdminAccess` | POST yes | Migration audit | Duplicate-safe |

### INFO items from `npm run security:api` — justification

Routes without direct `writeAuditLog` in the route handler delegate auditing to `lib/communications/contentWorkflow.ts` (`sanitizeAuditMetadata` + `writeAuditLog`). This is intentional to avoid duplicate audit rows.

| Route | Justification |
|-------|---------------|
| `/api/admin/communications/*/approve` etc. | Audit in `approveContent`, `rejectContent`, `publishContent`, `withdrawContent` |
| `/api/advisor/insights` POST | Audit in `createContentDraft` |
| `/api/advisor/insights/[contentId]/submit` | Audit in `submitContentForReview` |
| `/api/advisor/insights/[contentId]` PATCH | Audit in `createContentEditVersion` / `withdrawContent` |
| `/api/advisor/clients/[clientId]/binder-export` | Audit in `generateBinderExport` |
| `/api/admin/promotions-migration` POST | Audit in `migratePromotionToDraft` |

## RLS summary

| Table | RLS | Client policies | Write path |
|-------|-----|-----------------|------------|
| `governed_content` | Enabled | None | Service-role API only |
| `client_notifications` | Enabled | Owner SELECT/UPDATE | Service-role create; client read own |
| `communication_preferences` | Enabled | Owner SELECT/UPDATE | Service-role seed; client PATCH own |
| `communication_deliveries` | Enabled | None | Service-role only |
| `binder_exports` | Enabled | None | Service-role only |
| `promotion_migration_reviews` | Enabled | None | Admin API only |

Clients cannot enumerate `governed_content` — feed is assembled server-side per session.

## Scheduling

Phase 9E has **no background scheduler**. `scheduled` status records intent; admin must call publish when due. Feed uses `isClientVisibleStatus` which excludes future `scheduled_at`.

## Email delivery

Synchronous send on publish (not a queue worker). `communication_deliveries` tracks status; retries reuse the same row. Absent Resend credentials use dev adapter without breaking staging.

## External links

Primary control: human admin approval. Technical controls: https-only, encoded-scheme rejection, no credentials in URL, private-network host rejection. Domain allowlist is optional supplementary only.

## Binder export

Phase 9E produces an **export manifest record** (section IDs, publication IDs, storage path placeholder) — not a rendered PDF. Full PDF rendering deferred.

## Document events — implemented vs deferred

| Event | Status |
|-------|--------|
| uploaded | Implemented (client + adviser upload routes) |
| published_to_client | Implemented (adviser upload when active client) |
| removed | Implemented (client delete) |
| replaced, superseded, withdrawn, action_required, action_completed, downloaded | **Deferred** — types defined; hooks not wired to all document routes |

## Audit metadata

`lib/communications/auditMetadata.ts` strips sensitive keys and truncates values. Workflow uses `sanitizeAuditMetadata` for all Phase 9E content audits.

## Browser/cache

- Client Insights/notifications/preferences APIs: `private, no-store`
- No `localStorage` for feed or notifications
- No `dangerouslySetInnerHTML` in Insights UI
- External links: `rel="noopener noreferrer"`

## Remaining compliance-review items

- Firm-approved consent wording for promotional preferences
- Dedicated compliance approver role (admin interim)
- Full document lifecycle notification hooks
- Binder PDF rendering and client vault publication workflow
- Optional domain allowlist configuration for external links

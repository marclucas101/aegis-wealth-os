# Phase 9E Communications Audit

Audit date: Phase 9E build. Branch: `phase-9e-communications-governance`.

## Summary

Phase 9E introduces governed communications (`governed_content`) to replace the legacy Promotions experience for active clients. Legacy Promotions remain in place but are not auto-migrated or auto-published.

| Feature | Route | Audience | Approval | Delivery | Risk | Decision |
|---------|-------|----------|----------|----------|------|----------|
| Legacy Promotions (client) | `/promotions`, `GET /api/promotions` | All authenticated clients (legacy nav) | Adviser self-publish | In-app page | Product promotion without governance | **Retire** from active-client nav; keep table |
| Legacy Promotions (adviser) | `/advisor/promotions` | Adviser/admin | Self-publish | In-app | Uncontrolled audience | **Defer** removal to Phase 9F |
| Insights placeholder | `/insights` | Active clients | N/A | N/A | N/A | **Migrate** → governed feed |
| Published outputs `insights_update` | Publication APIs | Per-client | Adviser review + publish | Client portal | Low when used correctly | **Reuse** for personalised outputs only |
| Adviser notifications | `GET /api/advisor/notifications` | Adviser | Computed | In-app dashboard | Low | **Reuse**; extend types in 9E |
| Client notifications | `GET /api/client/notifications` | Client | Server-created | In-app | Medium if over-sharing | **New** Phase 9E |
| Appointments email | Adviser appointment APIs | Client | Adviser action | Email (Resend) | Low | **Reuse** email abstraction |
| Document upload (client) | `POST /api/documents/upload` | Client | Relationship-stage gate | Audit + notification | Medium | **Extend** with document events |
| Document upload (adviser) | `POST /api/advisor/clients/.../upload` | Assigned adviser | Assignment gate | Audit + notification | Medium | **Extend** |
| Document delete | `POST /api/documents/delete` | Client | Owner gate | Audit + notification | Medium | **Extend** |
| Email provider | `lib/email/emailProvider.ts` | Server | N/A | Email | Low | **Reuse** |
| Audit logs | `audit_logs` table | Admin/service | Append-only | DB | Low | **Reuse** |
| Feature controls | `platform_feature_controls` | Admin | Admin override | DB | Low | **Extend** with 9E keys |
| Communication preferences | `GET/PATCH /api/client/communication-preferences` | Client | Session-scoped | DB | Low | **New** |
| Binder export | `POST /api/advisor/clients/[clientId]/binder-export` | Assigned adviser | Explicit generation | Adviser-internal | Medium | **New** |

## Legacy Promotions

- **Table:** `promotions` (`202606100016_promotions.sql`)
- **Client route:** `/promotions` — not in `ACTIVE_CLIENT_NAV_SECTIONS`; `features.promotions = false` for active clients
- **Adviser route:** `/advisor/promotions`
- **Decision:** Do **not** automatically expose Promotion records as Insights. Admin migration tool at `GET/POST /api/admin/promotions-migration` creates draft/submitted items only.

## Insights & Updates (Phase 9E)

- **Client route:** `/insights` → `InsightsFeedClient` → `GET /api/client/insights`
- **Adviser route:** `/advisor/insights`
- **Admin route:** `/admin/communications`
- **Table:** `governed_content`
- **Approval:** Admin/compliance (until dedicated compliance role exists)

## External article links

Previously only on Promotion `cta_url`. Phase 9E validates https-only via `lib/communications/externalLinkValidation.ts`. No article scraping.

## Deferred to Phase 9F

- Destructive removal of legacy Promotions tables/routes
- Dedicated compliance role (admin acts as approver in 9E)
- Broad marketing email automation
- Full PDF binder rendering (9E records metadata and approved section IDs)

# Phase 9F.4 — Route Authorization Matrix

| Route | Method | Auth | Write freeze | Ownership | Client entitlement | Response headers |
|-------|--------|------|--------------|-----------|-------------------|------------------|
| `/api/promotions` | GET | Client session | N/A (read) | N/A | `promotions` + `product_related_content`; else empty list | `private, no-store` |
| `/api/advisor/promotions` | GET | Adviser/admin | N/A | Adviser: own rows; admin: all | N/A | `private, no-store` |
| `/api/advisor/promotions` | POST | Adviser/admin | `legacy_promotions_write` | Creates as `created_by = auth user` | N/A | `private, no-store` |
| `/api/advisor/promotions/[id]` | GET | Adviser/admin | N/A | Adviser: own; admin: all; else 404 | N/A | `private, no-store` |
| `/api/advisor/promotions/[id]` | PATCH | Adviser/admin | `legacy_promotions_write` | Adviser: own; admin: all; else 404 | N/A | `private, no-store` |
| `/api/advisor/promotions/[id]/upload` | POST | Adviser/admin | `legacy_promotions_write` | Adviser: own; admin: all; else 404 | N/A | `private, no-store` |
| `/api/admin/promotions-migration` | GET | Admin | Exempt | Admin only | N/A | `private, no-store` |
| `/api/admin/promotions-migration` | POST | Admin + `admin_content_approval` | Exempt | Admin only; fixed classification allowlist | N/A | `private, no-store` |

## Blocked write response

HTTP **403** with `LEGACY_PROMOTIONS_WRITE_DISABLED` (see write-freeze architecture doc).

## IDOR test expectations (static QA)

| Scenario | Expected |
|----------|----------|
| Adviser A reads adviser B private draft | 404 |
| Adviser A edits adviser B promotion | 404 (or 403 if write disabled first) |
| Adviser A uploads to B promotion | 404 (or 403 if write disabled) |
| Adviser A publishes B promotion | 404 (or 403) |
| Forged promotion UUID | 404 |
| Client calls adviser route | 401/403 |

## Audit actions

| Action | When |
|--------|------|
| `legacy_promotion_write_blocked` | Mutation while write disabled |
| `legacy_promotion_viewed` | Admin views single promotion (optional noise control) |
| `legacy_promotion_migration_started` | Admin migration POST begins |
| `legacy_promotion_migration_completed` | Successful draft creation |
| `legacy_promotion_migration_failed` | Migration POST error |

Metadata excludes bodies, client data, audience lists, storage paths, signed URLs, and raw exceptions.

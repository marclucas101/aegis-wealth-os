# CRM V2 Phase 04 — Existing Client Appointment Audit

**Phase:** 04  
**Branch:** `crm-v2-04-appointments-client`  
**Rule:** Keep `adviser_appointments.id` as the only appointment authority.

---

## 1. Existing client appointment surfaces

- `app/my-adviser/page.tsx` + `components/aegis/my-adviser/MyAdviserClient.tsx` show client booking touchpoint and preparation link.
- `app/api/my-adviser/appointments/route.ts` reads upcoming client appointments from existing persistence.
- `app/api/my-adviser/book/route.ts` uses legacy booking flow with Google event creation.
- Existing client portal lacks a first-class `/appointments` dashboard and appointment detail route.

## 2. Existing appointment-request concepts

- Existing flow creates `adviser_appointments` rows directly through booking in `lib/supabase/appointmentsPersistence.ts`.
- Legacy booking uses adviser availability and immediate confirmation semantics.
- Phase 04 introduces explicit request/proposal collaboration while preserving one row identity.

## 3. Client identity resolution

- Authenticated client identity is resolved via `ensureUserClientProfile()`.
- Authoritative client row is `clients.id` linked by `clients.user_id`.
- Adviser assignment derives from `clients.advisor_user_id`.
- No browser-supplied `clientId` or `adviserId` accepted.

## 4. Notifications

- Existing in-app notifications use `client_notifications` and `dbCreateClientNotification`.
- Phase 04 reuses in-app path only; no email/SMS/WhatsApp additions.
- Retry/idempotency handling remains in existing notification persistence path.

## 5. Document upload and vault

- Existing client document workflow remains under `document-vault`.
- Phase 04 links to existing secure document upload authority only.
- No new storage bucket, no raw paths, no persisted signed URLs in appointment DTOs.

## 6. Meeting summaries and follow-up access

- Existing published summaries sourced from `published_outputs` through client-safe sanitizers.
- Client roadmap/follow-up remains rooted in `roadmap_items`.
- Phase 04 exposes only published outcomes and client-visible follow-up projections.

## 7. Duplicate-authority risks and decisions

| Risk | Decision |
|------|----------|
| New client appointment table | Rejected |
| Separate client appointment identity | Rejected |
| Reschedule creates new row | Rejected |
| Household as access proof | Rejected |
| Browser adviser/client identifiers | Rejected |

## 8. Reuse / retain / adapt / reject

- **Reuse:** `adviser_appointments`, `crm_appointment_*`, client session resolution, notifications, document-vault authority.
- **Retain:** adviser portal appointment APIs/routes unchanged; Meeting Studio integration unchanged.
- **Adapt:** add client-safe appointment DTO, client action APIs, and client route surfaces.
- **Reject:** second appointment authority, Google sync behavior in Phase 04, service/protection/moments/advocacy schema.

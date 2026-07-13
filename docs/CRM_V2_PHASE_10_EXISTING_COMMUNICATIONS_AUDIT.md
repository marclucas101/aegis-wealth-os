# CRM V2 Phase 10 — Existing Communications Audit

**Purpose:** Classify every pre-Phase-10 communications-related source — Phase 9E governed content, delivery logs, templates, preferences, legacy promotions, notifications, and adviser tooling — before introducing canonical `crm_communication_*` tables and CRM V2 adviser/client surfaces.  
**Rule:** One authoritative record per domain; projections, queues, and timeline entries are never SOT.

---

## Classification legend

| Label | Meaning |
|-------|---------|
| **Authoritative** | Existing SOT — mutations stay here unless explicitly superseded for a narrow field |
| **Reuse** | Read or link without copying payload into a duplicate table |
| **Projection** | Assembled read model only |
| **New** | Greenfield canonical table introduced Phase 10 |
| **Deferred** | Out of Phase 10 scope |
| **Rejected** | Duplicate authority — must not create |

---

## 1. Governed content (`governed_content`) — Phase 9E

| Item | Detail |
|------|--------|
| Table | `governed_content` — compliance-reviewed published client content |
| Routes | `/insights`, `/admin/communications`, publication APIs |
| Code | `lib/communications/contentWorkflow.ts`, `contentLifecycle.ts`, `publicationDelivery.ts` |
| Classification | **Authoritative** (published insights and governed publications) |
| Phase 10 decision | **Reuse / coexist** — `governed_content` remains SOT for published client-facing content. Phase 10 `crm_communication_records.governed_content_id` is an optional FK for linkage only. CRM V2 operational drafts and logs do **not** replace governed publication workflow. No auto-publish from CRM V2 drafts. |

---

## 2. Communication preferences (`communication_preferences`) — Phase 9E

| Item | Detail |
|------|--------|
| Table | `communication_preferences` — client-controlled channel and content opt-ins |
| APIs | Phase 9E `GET/PATCH /api/client/communication-preferences`; Phase 10 `GET/PATCH /api/preferences/communications` |
| Base columns | `in_app_operational`, `email_operational`, `educational_insights`, `market_updates`, `event_announcements`, `adviser_messages`, `promotional_content` |
| Classification | **Authoritative** |
| Phase 10 decision | **Reuse / extend** — migration `202606290017` adds `preferred_channel`, `do_not_contact`, `festive_acknowledgement_opt_out`, `client_message_visibility`, `last_confirmed_at`, `version`. No second preferences table. Adviser read via assignment-scoped API; client write via session-scoped API. |

---

## 3. Communication delivery records (`communication_deliveries`) — Phase 9E

| Item | Detail |
|------|--------|
| Table | `communication_deliveries` — email channel delivery audit for governed content |
| Classification | **Authoritative** (9E email delivery log) |
| Phase 10 decision | **Reuse / coexist** — Phase 10 does not duplicate delivery rows. CRM V2 records use `delivery_state = logged_only` for adviser-marked send/log; no automatic Resend/SMS/WhatsApp dispatch from CRM V2 transitions. |

---

## 4. Lifecycle notifications — Phase 9E

| Item | Detail |
|------|--------|
| Code | `lib/communications/lifecycleNotificationService.ts`, `lifecycleNotificationPersistence.ts` |
| Classification | **Authoritative** (9E document/appointment notification pipeline) |
| Phase 10 decision | **Reuse / coexist** — Phase 10 adds in-app notifications via `lib/crm-v2/communications/notifications.ts` (`crm_client_message`, `communication_preference_updated`). No outbound email/SMS from CRM V2 message transitions. |

---

## 5. Legacy Promotions (`promotions`)

| Item | Detail |
|------|--------|
| Table | `promotions` — legacy marketing content (schema retained) |
| APIs | Retired from active client nav; `legacy_promotions_write` remains **false** |
| Observation | **Phase 9F.4** — 30-day operator-extended observation per `docs/PHASE_9F4_OBSERVATION_PLAN.md` |
| Classification | **Authoritative** (historical rows only) / **Rejected** for new CRM communications workflows |
| Phase 10 decision | **Rejected for CRM V2 communications** — Phase 10 introduces **no** Promotions Stage 6 schema retirement, **no** campaign automation, **no** auto-migration of promotion rows into `crm_communication_records`, **no** sales-opportunity or ranking tables. Adviser drafts and logs are operational CRM records, not promotion sends. |

**Phase 9F.4 confirmation (Phase 10):**

- Promotions observation continues unchanged during Phase 10 implementation
- No Stage 6 DROP migrations in Phase 10 deliverables (`202606290016`, `202606290017` contain zero `DROP TABLE promotions`)
- No re-enable of `legacy_promotions_write`
- CRM V2 communications does not write to `promotions`

---

## 6. Insights feed and client notifications — Phase 9E

| Item | Detail |
|------|--------|
| Routes | `/insights`, `GET /api/client/insights`, `GET /api/client/notifications` |
| Classification | **Authoritative** (governed feed) / **Reuse** (notification transport) |
| Phase 10 decision | **Reuse** — client message notifications use existing `client_notifications` persistence. Insights feed unchanged; CRM V2 client messages are a separate `/messages` surface gated by `crm_v2_communications`. |

---

## 7. Email provider (`lib/email/emailProvider.ts`)

| Item | Detail |
|------|--------|
| Usage | Appointment emails, 9E governed content delivery |
| Classification | **Reuse** |
| Phase 10 decision | **Not invoked** by CRM V2 communication transitions. `channelAllowsAutoSend()` returns `false` for all channels. External channels (`email_draft`, `whatsapp_draft`, `sms_draft`) are draft or log only. |

---

## 8. Adviser notifications (`GET /api/advisor/notifications`)

| Item | Detail |
|------|--------|
| Classification | **Reuse** |
| Phase 10 decision | **Reuse** — CRM V2 does not add outbound adviser email alerts for drafts. Work queue surfaces action-required communications. |

---

## 9. Document events and binder export — Phase 9E

| Item | Detail |
|------|--------|
| Code | `lib/communications/documentEventNotifications.ts`, `binderExport.ts` |
| Classification | **Authoritative** (document domain) / **Reuse** (export metadata) |
| Phase 10 decision | **Reuse** — `document_request` is an allowlisted `source_type` on threads/records for contextual linkage. No duplicate document tables. |

---

## 10. Audit logs (`audit_logs`)

| Item | Detail |
|------|--------|
| Classification | **Authoritative** |
| Phase 10 decision | **Reuse** — `writeAuditLog` on draft create (`crm_communication_draft_created`). Immutable domain detail in `crm_communication_domain_events`. |

---

## 11. Feature controls (`platform_feature_controls`)

| Item | Detail |
|------|--------|
| Phase 9E keys | `governed_communications`, `communication_preferences`, etc. |
| Phase 10 key | `crm_v2_communications` (single key; `client_visible=true`, `adviser_visible=true`, default disabled) |
| Classification | **Authoritative** |
| Phase 10 decision | **Extend** — one new row in `202606290016`. No separate `crm_v2_client_messages` key. Client and adviser surfaces share `crm_v2_communications`. |

---

## 12. Legacy adviser portal communications

| Item | Detail |
|------|--------|
| Routes | `/advisor/insights`, `/advisor/promotions` (legacy) |
| Classification | **Deferred** (legacy shell) |
| Phase 10 decision | **Coexist** — CRM V2 workspace at `/advisor-v2/communications` is additive. Legacy routes remain operational; no destructive retirement in Phase 10. |

---

## 13. CRM V2 domain tables introduced Phase 10

| Table | Classification |
|-------|----------------|
| `crm_communication_threads` | **New** — grouping context per client/source |
| `crm_communication_records` | **New** — drafts, logs, client-visible messages |
| `crm_communication_templates` | **New** — governed reusable wording (operator-approved seeds) |
| `crm_communication_domain_events` | **New** — immutable audit log |

---

## 14. Work queue and Relationship 360

| Item | Detail |
|------|--------|
| Adapter | `communicationRecordAdapter` |
| Projection | `lib/crm-v2/relationships/communicationsProjection.ts` |
| Classification | **Projection** |
| Phase 10 decision | **Projection only** — queue and R360 link never mutate `crm_communication_records`. |

---

## 15. Explicit non-scope confirmations

| Item | Phase 10 status |
|------|-----------------|
| Promotions Stage 6 DROP | **Not in scope** |
| Campaign automation tables | **None** |
| Automated external send (email/SMS/WhatsApp) | **None** — `mark_sent` sets `delivery_state=logged_only` only |
| Advocacy score → communication priority | **None** |
| Ethnicity/wealth segmentation triggers | **None** — `COMMUNICATION_PROHIBITED_USES` enforced in restrictions module |
| Sales-opportunity schema | **None** |
| Product recommendation engine | **None** |

---

## 16. Audit sign-off

| Check | Result |
|-------|--------|
| Phase 9E `governed_content` retained as published-content SOT | Confirmed |
| `communication_preferences` extended, not replaced | Confirmed |
| No duplicate preferences or delivery authority | Confirmed |
| No Promotions Stage 6 in Phase 10 migrations | Confirmed |
| No campaign automation introduced | Confirmed |
| Draft or log only — no automatic external send | Confirmed |

**Branch:** `crm-v2-10-communications`

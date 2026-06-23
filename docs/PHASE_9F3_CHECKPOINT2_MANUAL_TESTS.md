# Phase 9F.3 Checkpoint 2 — Manual Tests

Run after migration `202606200010` is applied in **staging** and `binder_export` feature is enabled for test advisers.

---

## Prerequisites

- [ ] Staging DB has migration `202606200010` applied
- [ ] `binder-exports` bucket exists (private, PDF-only)
- [ ] Test adviser assigned to test client with published outputs for selected sections
- [ ] `binder_export` feature flag enabled

---

## Generation

1. **Happy path** — POST `…/binder-export` with default sections and `meetingDate`. Expect `generationStatus: ready`, `reused: false`.
2. **Idempotent reuse** — Repeat identical POST. Expect `reused: true`, same `id` and `version`.
3. **Section change** — Remove one section. Expect new `id`, incremented `version`.
4. **Invalid section** — POST `sections: ["invalid_section"]`. Expect 400.
5. **Extra body fields** — POST with `clientId` or `storagePath`. Expect 400.
6. **Unassigned client** — POST for client not assigned to adviser. Expect 403.
7. **Feature disabled** — Disable `binder_export`. Expect 403.

---

## Listing

8. **List binders** — GET `…/binder-exports`. Expect newest first, no storage paths or hashes.
9. **Status filter** — GET `?generationStatus=ready`. Expect only ready rows.
10. **Invalid filter** — GET `?generationStatus=unknown`. Expect 400.

---

## Download

11. **Signed URL** — GET `…/binder-exports/[id]/signed-url` for ready binder. Expect `signedUrl`, `expiresIn: 120`.
12. **Not ready** — Request URL for `failed` or `pending` binder. Expect 409 / `BINDER_NOT_READY`.
13. **Cross-client binder ID** — Use binder ID from another client. Expect 403.
14. **Audit** — Verify `binder_downloaded` audit row contains binder ID only (no URL/path).

---

## PDF quality (visual)

15. Open downloaded PDF — A4 portrait, readable margins, confidentiality footer.
16. Long client name — no text outside page bounds.
17. Multi-section pack — multiple pages, tables wrap, headings not orphaned at page bottom.
18. Grayscale print — accents remain readable.

---

## Security

19. Response headers include `Cache-Control: private, no-store`.
20. List/generate responses omit `storage_path`, `content_hash`, `storage_bucket`.
21. PDF contains no NRIC, account numbers, or adviser-internal notes from fixture data.

---

## Failure / retry (staging)

22. Simulate storage failure (disable bucket write temporarily). Expect `failed` + `BINDER_STORAGE_FAILED`.
23. Retry same request after fix. Expect same row transitions to `ready` (failed retry path).

---

## Out of scope (do not test in Checkpoint 2)

- Publish to client vault
- Client binder download
- Withdraw / supersede workflows
- Phase 9F.4 work

# Phase 9F.3 Release Sign-Off

**Status:** UNSIGNED — awaiting operator execution

---

## Schema verification

| Item | Required | Actual | Sign-off |
|------|----------|--------|----------|
| Main diagnostic EXACT_MATCH (65/65) | Yes | | ☐ |
| Discrepancy diagnostic zero rows | Yes | | ☐ |
| Migration `202606200010` in history | Yes | | ☐ |
| Dry-run up to date | Yes | | ☐ |

**Owner:** __________________ **Date:** __________

---

## Automated QA

| Gate | Required | Actual | Sign-off |
|------|----------|--------|----------|
| `qa:phase9f3-binder-client-vault` | 198/198 | | ☐ |
| `qa:phase9f3-local-acceptance` | 25/25 | | ☐ |
| `qa:diagnostic-sql-syntax` | 29/29 parse | | ☐ |
| `tsc --noEmit` | Pass | | ☐ |
| `lint` | Pass | | ☐ |
| `build` | Pass | | ☐ |

**Owner:** __________________ **Date:** __________

---

## Staging acceptance

| Item | Sign-off |
|------|----------|
| Manual tests 1–17 executed | ☐ |
| PDF privacy inspection passed | ☐ |
| Cross-client denial verified | ☐ |

**Owner:** __________________ **Date:** __________

---

## Security acceptance

| Item | Sign-off |
|------|----------|
| `security:api` — no WARN gaps | ☐ |
| `security:advisor-access` — 11/11 | ☐ |
| `security:service-role` — no critical | ☐ |
| No storage path / signed URL in APIs | ☐ |

**Owner:** __________________ **Date:** __________

---

## Privacy acceptance

| Item | Sign-off |
|------|----------|
| No NRIC / account / policy IDs in PDF | ☐ |
| No internal notes in PDF | ☐ |
| Audit metadata excludes paths and URLs | ☐ |

**Owner:** __________________ **Date:** __________

---

## Deployment approval

| Item | Sign-off |
|------|----------|
| Branch merged to `main` (operator approved) | ☐ |
| Application deployed | ☐ |
| Rollback plan acknowledged | ☐ |

**Owner:** __________________ **Date:** __________

---

## Feature-enablement approval

| Order | Feature | Enabled | Sign-off |
|-------|---------|---------|----------|
| 1 | `binder_export` | | ☐ |
| 2 | `binder_client_publication` | | ☐ |
| 3 | `document_event_notifications` | | ☐ |

**Owner:** __________________ **Date:** __________

---

## Production monitoring

| Item | Sign-off |
|------|----------|
| Error rates baseline captured | ☐ |
| Audit log monitoring active | ☐ |
| 24h post-enable review scheduled | ☐ |

**Owner:** __________________ **Date:** __________

---

## Final owner sign-off

I confirm Phase 9F.3 binder PDF and client vault is approved for production operation per the enablement sequence in `PHASE_9F3_DEPLOYMENT_AND_ENABLEMENT.md`.

**Name:** __________________  
**Role:** __________________  
**Signature:** __________________  
**Date:** __________

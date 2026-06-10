# Legal & Compliance Notes — Phase 4V

**Date:** 2026-06-10  
**Status:** MVP draft layer for demo / private beta  
**Purpose:** Document the in-product legal, consent, and disclaimer implementation before lawyer review.

---

## Overview

Phase 4V adds a lightweight legal and compliance layer without changing core app functionality, database schema, or auth security. All legal text is marked as **draft template** content and must be reviewed by qualified legal counsel before commercial use.

**This implementation does not claim regulatory compliance, MAS approval, licensing, or certification.**

---

## Legal pages

| Route | Purpose |
|-------|---------|
| `/legal/terms` | Terms of Use — acceptable use, service nature, liability draft |
| `/legal/privacy` | Privacy Policy — data processing, role-based access, document handling |
| `/legal/disclaimer` | Financial Planning Disclaimer — planning-support limitations |
| `/legal/consent` | Client Consent Overview — upload consent, advisor access summary |

Each page uses `LegalPageShell` with a prominent draft-template warning banner.

---

## Components

| Component | Role |
|-----------|------|
| `LegalPageShell` | Shared layout for legal pages with footer nav |
| `LegalNoticeCard` | Styled callout blocks (info / warning / neutral) |
| `ConsentBanner` | Site-wide dismissible banner (localStorage) |
| `ReportDisclaimerBlock` | On-screen report disclaimers (screen + compact variants) |
| `DocumentUploadConsent` | Pre-upload consent language in document vault |
| `AdvisorAccessConsent` | Advisor/admin access summary |
| `ClientTrustNotice` | Contextual trust notices with legal links |
| `ReportDisclaimer` | Print/export disclaimer block (shared copy via `lib/aegis/legal.ts`) |

---

## Shared content

Central constants live in `lib/aegis/legal.ts`:

- `LEGAL_ROUTES` / `LEGAL_LINKS`
- `CONSENT_BANNER_STORAGE_KEY` (`aegis-legal-notice-dismissed-v1`)
- `DRAFT_LEGAL_WARNING`
- `PLANNING_SUPPORT_DISCLAIMER`
- `REPORT_DISCLAIMER_PARAGRAPHS`

---

## Where notices appear

| Location | Notice |
|----------|--------|
| All pages (root layout) | `ConsentBanner` — non-blocking, dismissible |
| Home page footer | Terms · Privacy · Disclaimer · Consent links |
| Legal pages | Cross-links in footer + draft warning |
| Dashboard | `ClientTrustNotice` (general, full) + legal links |
| Document vault upload | `DocumentUploadConsent` + `ClientTrustNotice` (documents) |
| Wealth Blueprint | `ClientTrustNotice` + `ReportDisclaimerBlock` + footer compact disclaimer |
| Annual Review | `ClientTrustNotice` + `ReportDisclaimerBlock` + footer compact disclaimer |
| Print exports | `ReportDisclaimer` (Wealth Blueprint + Annual Review print routes) |
| Advisor report viewer | Existing `ReportDisclaimer` (print-styled) |

---

## Consent model (MVP)

- **No database-backed consent tracking**
- **No e-signature**
- Banner dismissal stored in `localStorage` only
- Upload and access consent are informational — not blocking gates
- Existing app usage is not blocked by mandatory consent flows

---

## Before commercial deployment

1. Engage qualified legal counsel to review and replace all draft text
2. Define jurisdiction, governing law, and data retention policies
3. Implement formal consent records if required by regulation
4. Add privacy-policy acceptance at signup if counsel requires it
5. Review advisor/client data-processing agreements (DPA)
6. Confirm insurance and licensing disclosures for advisor firms using AEGIS
7. Do **not** load real client PII/financial data until legal sign-off

---

## Testing checklist

- [ ] Visit `/legal/terms`, `/legal/privacy`, `/legal/disclaimer`, `/legal/consent`
- [ ] Confirm draft-template warning visible on each legal page
- [ ] Dismiss consent banner → refresh → banner stays hidden
- [ ] Clear `localStorage` key `aegis-legal-notice-dismissed-v1` → banner reappears
- [ ] Home page footer links navigate correctly
- [ ] Document vault upload shows upload consent block
- [ ] Wealth Blueprint and Annual Review show disclaimer blocks
- [ ] Print routes still render `ReportDisclaimer`
- [ ] `npx tsc --noEmit` and `npm run build` pass

---

## Known limitations

- Legal text is template-only — not jurisdiction-specific
- No audit trail for consent acknowledgment
- Banner dismissal is per-browser, not per-user account
- Advisor and admin portals do not yet have dedicated legal footers
- No cookie policy or third-party processor schedule (beyond Supabase mention in privacy draft)
- No formal data-subject request workflow

---

## Related docs

- [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md) — Section 14 Legal & Compliance
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) — Phase E sign-off

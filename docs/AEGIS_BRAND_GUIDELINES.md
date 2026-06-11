# AEGIS Brand Guidelines (Internal)

Concise reference for advisors, reports, and client-facing documents within the AEGIS Wealth Operating System.

## Visual Identity

- **Background palette:** Deep navy and emerald tones. Reports and print layouts should feel anchored, not bright or playful.
- **Accent palette:** Muted institutional gold (`#D1A866` and related tones). Use sparingly for headings, dividers, KPI highlights, and emphasis — never as large flat fills.
- **Logo assets:** Use official marks from `/public/brand/`:
  - Full wordmark: `aegis-logo.svg`
  - Monogram: `aegis-monogram.svg`
  - Programmatic paths: `lib/brand.ts` (`BRAND.assets`)
- **Avoid:** Crypto, startup, gaming, neon gradients, stock-photo clichés, or generic spreadsheet aesthetics.

## Tone of Voice

- **Luxury private bank / family office register:** Calm, precise, protective.
- **Language:** Clear and confident. Prefer “portfolio”, “coverage in force”, “household”, and “statement period” over casual or hype-driven phrasing.
- **Avoid:** Fear-based selling, jargon without context, or overly casual contractions in formal reports.

## Typography & Layout (Reports)

- **Refined and spacious:** Generous margins, clear section hierarchy, readable line length for print.
- **Hierarchy:** Section labels in small caps or tracked uppercase; body copy in a clean serif or refined sans (match app conventions at implementation time).
- **Print-ready:** High contrast for body text; gold accents for structure, not body copy.
- **Data presentation:** KPI cards should read like private banking summary tiles, not dashboard widgets.

## Report Document Standards

Protection and wealth reports should feel like **private banking / family office documents**:

1. Cover page with household name, primary contact, statement period, adviser name and company.
2. Confidentiality treatment on cover and final pages.
3. Structured sections: people, portfolio overview, policy detail, investment allocation (where relevant), next steps.
4. Footer or closing language reinforcing confidentiality and intended recipient.

## Confidentiality & Footer Language

Use consistently on cover, section footers, and closing pages:

- **Short:** `Confidential · Prepared for the named household only`
- **Standard:** `Confidential. Prepared exclusively for the named household. Not for redistribution without adviser consent.`
- **Closing:** Pair with statement date and adviser attribution (name, company).

## Implementation Notes

- Reuse `lib/brand.ts` and `components/brand/BrandLogo.tsx` in UI; do not duplicate asset paths.
- Report PDF generation (future phases) must follow this palette and tone before adding bespoke layout experiments.

export const LEGAL_ROUTES = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  disclaimer: "/legal/disclaimer",
  consent: "/legal/consent",
} as const;

export type LegalRouteKey = keyof typeof LEGAL_ROUTES;

export const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: LEGAL_ROUTES.terms, label: "Terms" },
  { href: LEGAL_ROUTES.privacy, label: "Privacy" },
  { href: LEGAL_ROUTES.disclaimer, label: "Disclaimer" },
  { href: LEGAL_ROUTES.consent, label: "Consent" },
];

export const CONSENT_BANNER_STORAGE_KEY = "aegis-legal-notice-dismissed-v1";

export const DRAFT_LEGAL_WARNING =
  "Draft legal template — for demo and private beta preparation only. Must be reviewed and approved by a qualified lawyer before commercial use.";

export const PLANNING_SUPPORT_DISCLAIMER =
  "AEGIS outputs are planning-support tools intended to support advisor-reviewed conversations. They are not standalone financial, investment, tax, legal, or insurance advice unless reviewed and delivered by a qualified licensed advisor.";

export const REPORT_DISCLAIMER_PARAGRAPHS = [
  "This report is planning-support output generated from information you provided through the AEGIS Wealth Operating System™. It is intended to support structured conversations with a qualified wealth advisor.",
  "It does not constitute standalone financial, investment, tax, legal, or insurance advice. Scores, projections, and stress scenarios are illustrative diagnostics — not guarantees of future outcomes. Review all outputs with a qualified advisor before making financial decisions.",
] as const;

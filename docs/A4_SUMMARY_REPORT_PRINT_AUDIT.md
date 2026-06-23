# A4 Summary Report Print Audit

**Date:** 2026-06-23  
**Scope:** Protection Portfolio Summary (adviser) and client Wealth Blueprint / Annual Review print routes.

---

## Generation methods identified

| Report | Primary export | Secondary export | Library |
|--------|----------------|------------------|---------|
| **Protection Portfolio Summary** | `window.print()` from `/advisor/protection-report` | `html2canvas` + `jsPDF` via Save to Vault | `jspdf`, `html2canvas` |
| **Wealth Blueprint** | Dedicated route `/wealth-blueprint/print` → `window.print()` | — | Browser print CSS |
| **Annual Review** | Dedicated route `/annual-review/print` → `window.print()` | — | Browser print CSS |
| **Adviser saved blueprint/review** | `/advisor/clients/.../print` routes → `ReportPrintShell` | — | Browser print CSS |

There is **no server-side PDF renderer** for these summary reports in the current codebase.

---

## Key components

| Path | Role |
|------|------|
| `components/aegis/advisor/protection-report/ProtectionReportClient.tsx` | Form, preview toggle, Print / Vault actions |
| `components/aegis/advisor/protection-report/ProtectionReportPreview.tsx` | Multi-page A4 document markup (`.print-page` sections) |
| `components/aegis/advisor/protection-report/ProtectionReportVisuals.tsx` | `ReportPrintPage`, charts, cards |
| `src/features/document-vault/generateProtectionReportPdf.ts` | Client-side PDF blob for vault upload |
| `components/aegis/reports/ReportPrintShell.tsx` | Print toolbar + `window.print()` for blueprint/review |
| `app/wealth-blueprint/print/page.tsx` | Client blueprint print route |
| `app/annual-review/print/page.tsx` | Client annual review print route |
| `app/globals.css` | Legacy animation utilities |
| `app/report-a4-print.css` | **Dedicated A4 layout + `@media print` contract** |
| `lib/reports/a4Print.ts` | A4 constants, font wait, sanitized print helper |

---

## Root causes of awkward printing (pre-fix)

1. **No fixed A4 width on screen** — preview used responsive dashboard widths; browser print scaled inconsistently.
2. **Forced `min-height: 297mm` + `page-break-after: always` on every section** — short pages left gaps; long pages overflowed and clipped.
3. **`report-print-avoid-break` on entire page wrappers** — prevented natural pagination inside long portfolio sections.
4. **Portfolio chapter overcrowding** — coverage charts, premium grids, and per-policy summaries on one page.
5. **`html2canvas` captured at `scrollWidth`** — not locked to A4 pixel width; PDF export stretched or clipped content.
6. **Wealth Blueprint cover used `min-h-[70vh]`** — cover did not map to one A4 sheet.
7. **`ReportPrintShell` used `max-w-4xl`** — ~896px content width vs ~794px A4 at 96dpi.

---

## Fix approach (this change)

- Introduced `report-a4-document` / `report-page` CSS contract (`210mm` width, `16mm` padding).
- Replaced rigid per-page min-height with chapter `break-before: page` and allow internal breaks.
- Split protection portfolio into summary + detail pages.
- Locked jsPDF + html2canvas to A4 mm/px dimensions with slice pagination for tall captures.
- Print actions wait for fonts and debounce duplicate clicks.
- Blueprint/review print routes inherit the same A4 document shell.

---

## Unchanged by design

- Protection report **calculations** (`summarizeProtectionReport`, coverage/premium helpers).
- Report **authorization** (adviser routes, client print routes).
- Underlying **wording** and narrative copy.

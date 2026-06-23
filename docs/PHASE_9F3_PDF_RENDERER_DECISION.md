# Phase 9F.3 PDF Renderer Decision

**Date:** 2026-06-24  
**Checkpoint:** 9F.3 — Checkpoint 2  
**Verdict:** **Use `jspdf` v4.2.1 server-side (programmatic layout)**

---

## Requirement summary

| Requirement | Decision |
|-------------|----------|
| Server-compatible | ✅ Verified in Node 20 via `new jsPDF({ unit: "mm", format: "a4" })` |
| Deterministic | ✅ Programmatic text/cards/tables — no DOM or screenshots |
| True A4 pagination | ✅ `format: "a4"`, portrait, 210×297 mm |
| Structured content | ✅ Headings, paragraphs, cards, tables |
| No browser dependencies | ✅ No `window`, DOM, canvas, `html2canvas` |
| Next.js server routes | ✅ Imported only from `import "server-only"` modules |

---

## Options evaluated

| Library | Result |
|---------|--------|
| **jsPDF 4.2.1** | **Selected** — already installed; works in Node; outputs valid `%PDF-` bytes |
| html2canvas + jsPDF | **Rejected** — browser capture pipeline (used only for protection report client export) |
| Headless Chromium / Puppeteer | **Rejected** — explicit scope exclusion |
| pdfkit | Not adopted — would add dependency; jsPDF already meets requirements |

---

## Runtime verification

```bash
npx tsx -e "import { jsPDF } from 'jspdf'; const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }); pdf.text('Server test', 20, 20); const buf = Buffer.from(pdf.output('arraybuffer')); console.log(buf.slice(0,5).toString());"
# Output: %PDF-
```

---

## Binder vs protection report

| Flow | Renderer |
|------|----------|
| Binder meeting pack (9F.3) | Server-only `lib/binder/binderPdfRenderer.ts` |
| Protection report vault save | Client `html2canvas` + jsPDF (`generateProtectionReportPdf.ts`) |

Binder generation **must not** import protection report or `html2canvas` modules.

---

## Layout contract

- Page: 210 mm × 297 mm (A4 portrait)
- Margins: 16 mm (within 15–18 mm target)
- Content width: 178 mm
- Typography: Helvetica (built-in PDF font — deterministic, grayscale-safe)
- Colours: restrained navy `#10283A`, emerald `#107A5E`, gold `#D1A866` accents
- Footer: generic confidentiality line per page
- No embedded JavaScript, attachments, or external URLs

---

## Risk notes

- jsPDF built-in fonts only (no custom webfont embedding) — acceptable for MVP adviser packs
- Complex chart rendering deferred — binder uses text/cards/tables only
- If a future jsPDF release breaks Node compatibility, fallback candidate is `pdfkit`

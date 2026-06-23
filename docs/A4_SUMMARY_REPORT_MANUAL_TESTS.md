# A4 Summary Report — Manual Acceptance Tests

## Protection Portfolio Summary (`/advisor/protection-report`)

1. Load sample data → Generate Report Preview.
2. Confirm preview pages are **210mm wide** centred on screen with visible page separation.
3. Chrome → Print preview → Paper **A4**, Scale **100%**, Margins **Default/None**.
4. Verify navigation, form, and preview toolbar are **hidden** in print output.
5. Short report: cover + people pages — no extra blank page after final section.
6. Long report (many policies): portfolio splits across summary + detail pages without clipped right edge.
7. Policy detail pages: cards and charts do not split mid-card.
8. Save to Document Vault → open PDF — pages are A4 portrait without horizontal clipping.
9. Repeat Print click rapidly — only one dialog; button shows **Preparing Print…** while waiting.
10. Edge: long household name — filename sanitized, no NRIC in title or filename.

## Wealth Blueprint print (`/wealth-blueprint/print`)

11. Export / Print from blueprint page opens print route.
12. Cover fills one A4 page without large empty gap at bottom.
13. Score summary cards do not split across pages.
14. Disclaimer block prints on final section without orphan heading.

## Annual Review print (`/annual-review/print`)

15. Same checks as Wealth Blueprint (cover, sections, disclaimer).

## Browsers

16. Chrome print preview — backgrounds on: brand gold/navy bars visible.
17. Chrome print preview — backgrounds off: text and structure remain readable.
18. Edge print preview — same as Chrome at 100% scale (no “Fit to page” required).
19. Save as PDF — footer URLs not appended after links.

## Physical print (optional)

20. Print one protection report on A4 paper — margins approximately 15–18mm; no content clipped on right.

## Regression

21. Normal dashboard / advisor form layout unchanged when not printing.
22. Protection report calculations match pre-change values for sample dataset.

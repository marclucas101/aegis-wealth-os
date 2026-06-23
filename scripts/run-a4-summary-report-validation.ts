/**
 * A4 summary report print validation — structural checks.
 * Run: npm run qa:a4-summary-report
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function record(id: number, name: string, fn: () => void): TestCase {
  return { id, name, run: fn };
}

const TESTS: TestCase[] = [
  record(1, "@page uses A4 portrait", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes("@page") && css.includes("A4 portrait"), "A4 @page");
  }),
  record(2, "A4 dimensions defined", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes("210mm") && css.includes("297mm"), "mm dims");
    const ts = read("lib/reports/a4Print.ts");
    assert(ts.includes("A4_WIDTH_MM = 210"), "ts width");
    assert(ts.includes("A4_HEIGHT_MM = 297"), "ts height");
  }),
  record(3, "print margins controlled", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes("--report-a4-margin: 16mm"), "margin token");
    assert(css.includes("178mm"), "content width");
  }),
  record(4, "app navigation hidden in print", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes(".report-no-print"), "no-print class");
    assert(css.includes("display: none !important"), "hide rule");
    assert(read("components/aegis/AppShell.tsx").includes("report-no-print"), "shell");
  }),
  record(5, "action buttons hidden in print", () => {
    assert(read("components/aegis/reports/ReportPrintShell.tsx").includes("report-no-print"), "toolbar");
    assert(read("components/aegis/advisor/protection-report/ProtectionReportClient.tsx").includes("report-no-print"), "form chrome");
  }),
  record(6, "no horizontal overflow contract", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes("overflow: visible !important") || css.includes("max-width"), "overflow");
    assert(css.includes("table-layout: fixed"), "tables fixed");
  }),
  record(7, "cards avoid page splitting", () => {
    assert(read("app/report-a4-print.css").includes(".report-print-avoid-break"), "avoid break");
    assert(read("components/aegis/advisor/protection-report/ProtectionReportVisuals.tsx").includes("report-print-avoid-break"), "visuals");
  }),
  record(8, "charts avoid page splitting", () => {
    assert(read("app/report-a4-print.css").includes(".report-print-chart"), "chart class");
    assert(read("components/aegis/advisor/protection-report/ProtectionReportVisuals.tsx").includes("report-print-chart"), "svg chart");
  }),
  record(9, "headings avoid orphaning", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes(".report-print-section-heading"), "section heading");
    assert(css.includes("break-after: avoid"), "break after avoid");
    assert(read("components/aegis/reports/ReportSection.tsx").includes("report-print-section-heading"), "section component");
  }),
  record(10, "table headers repeat where supported", () => {
    assert(read("app/report-a4-print.css").includes("table-header-group"), "thead repeat");
  }),
  record(11, "long table content wraps", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes("overflow-wrap: anywhere"), "wrap");
    assert(css.includes("word-break: break-word"), "word break");
  }),
  record(12, "screen styles remain separate", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes(".protection-report-preview") && css.includes("@media print"), "split modes");
    assert(css.includes("margin-bottom: 1.25rem"), "screen preview gap");
  }),
  record(13, "print colours preserved", () => {
    const css = read("app/report-a4-print.css");
    assert(css.includes("print-color-adjust: exact"), "color adjust");
    assert(css.includes("-webkit-print-color-adjust: exact"), "webkit adjust");
  }),
  record(14, "PDF configuration uses A4", () => {
    const pdf = read("src/features/document-vault/generateProtectionReportPdf.ts");
    assert(pdf.includes('format: "a4"'), "jspdf a4");
    assert(pdf.includes('orientation: "portrait"'), "portrait");
    assert(pdf.includes("unit: \"mm\""), "mm unit");
    assert(pdf.includes("A4_PRINT.widthPx"), "fixed capture width");
  }),
  record(15, "report generation waits for fonts/charts", () => {
    const lib = read("lib/reports/a4Print.ts");
    assert(lib.includes("waitForPrintAssets"), "wait helper");
    assert(lib.includes("document.fonts"), "fonts ready");
    assert(read("components/aegis/reports/ReportPrintShell.tsx").includes("runBrowserPrint"), "shell uses wait");
    assert(read("components/aegis/advisor/protection-report/ProtectionReportClient.tsx").includes("runBrowserPrint"), "protection uses wait");
  }),
  record(16, "report calculations unchanged", () => {
    assert(existsSync("src/features/advisor-console/protection-report/index.ts"), "calc module");
    const preview = read("components/aegis/advisor/protection-report/ProtectionReportPreview.tsx");
    assert(preview.includes("summarizeProtectionReport"), "summary calc");
    assert(preview.includes("calculateMonthlyPremium"), "premium calc");
  }),
  record(17, "sensitive fields not added to print footer", () => {
    const footer = read("components/aegis/advisor/protection-report/ProtectionReportVisuals.tsx");
    assert(!footer.includes("clientId"), "no client id");
    assert(!footer.includes("storage_path"), "no storage path");
    assert(footer.includes("AEGIS Confidential"), "confidential label only");
  }),
  record(18, "output filename sanitized", () => {
    const lib = read("lib/reports/a4Print.ts");
    assert(lib.includes("sanitizeReportFilenameBase"), "sanitizer");
    assert(read("src/features/document-vault/saveProtectionReportToVault.ts").includes("sanitizeReportFilenameBase"), "vault save");
  }),
  record(19, "no service-role in client report components", () => {
    for (const file of [
      "components/aegis/advisor/protection-report/ProtectionReportClient.tsx",
      "components/aegis/advisor/protection-report/ProtectionReportPreview.tsx",
      "components/aegis/reports/ReportPrintShell.tsx",
      "src/features/document-vault/generateProtectionReportPdf.ts",
    ]) {
      const src = read(file);
      assert(!src.includes("service_role"), file);
      assert(!src.includes("createAdminSupabaseClient"), file);
    }
  }),
  record(20, "audit documentation exists", () => {
    assert(existsSync("docs/A4_SUMMARY_REPORT_PRINT_AUDIT.md"), "audit doc");
    assert(existsSync("docs/A4_SUMMARY_REPORT_MANUAL_TESTS.md"), "manual tests");
  }),
];

function main(): void {
  let passed = 0;
  for (const test of TESTS) {
    try {
      test.run();
      passed++;
      results.push({ id: test.id, name: test.name, passed: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.error(`  ✗ ${test.id}. ${test.name}: ${message}`);
    }
  }

  console.log(`A4 summary report print: ${passed}/${TESTS.length} passed`);
  if (passed !== TESTS.length) {
    process.exit(1);
  }
}

main();

/** A4 portrait print contract — shared by browser print and jsPDF export. */

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A4_MARGIN_MM = 16;
export const A4_CONTENT_WIDTH_MM = A4_WIDTH_MM - A4_MARGIN_MM * 2;

/** CSS pixels at 96dpi — used for html2canvas capture width. */
export const A4_WIDTH_PX = Math.round((A4_WIDTH_MM / 25.4) * 96);
export const A4_HEIGHT_PX = Math.round((A4_HEIGHT_MM / 25.4) * 96);

export const A4_PRINT = {
  widthMm: A4_WIDTH_MM,
  heightMm: A4_HEIGHT_MM,
  marginMm: A4_MARGIN_MM,
  contentWidthMm: A4_CONTENT_WIDTH_MM,
  widthPx: A4_WIDTH_PX,
  heightPx: A4_HEIGHT_PX,
} as const;

export function sanitizeReportFilenameBase(label: string): string {
  const base = (label || "report")
    .replace(/[^\w.\-()+ ]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 60);

  return base || "report";
}

export async function waitForPrintAssets(): Promise<void> {
  if (typeof document === "undefined") return;

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Font loading API unavailable — continue.
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export async function runBrowserPrint(options?: {
  documentTitle?: string;
  onError?: (message: string) => void;
}): Promise<void> {
  if (typeof window === "undefined") return;

  const previousTitle = document.title;
  if (options?.documentTitle) {
    document.title = options.documentTitle;
  }

  document.body.classList.add("report-print-active");

  try {
    await waitForPrintAssets();
    window.print();
  } catch {
    options?.onError?.("Unable to open the print dialog. Please try again.");
  } finally {
    window.setTimeout(() => {
      document.body.classList.remove("report-print-active");
      if (options?.documentTitle) {
        document.title = previousTitle;
      }
    }, 500);
  }
}

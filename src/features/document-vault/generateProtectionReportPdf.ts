import { A4_HEIGHT_MM, A4_PRINT, A4_WIDTH_MM, waitForPrintAssets } from "@/lib/reports/a4Print";

/**
 * Renders each `.print-page` section in the protection report preview into a
 * multi-page A4 PDF blob (client-side only).
 */
export async function generateProtectionReportPdf(
  rootElement: HTMLElement,
): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const pages = Array.from(rootElement.querySelectorAll<HTMLElement>(".print-page"));

  if (pages.length === 0) {
    throw new Error("Report preview is not ready. Generate the preview first.");
  }

  await waitForPrintAssets();

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });

  let pdfHasPage = false;

  for (const page of pages) {
    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: A4_PRINT.widthPx,
      windowWidth: A4_PRINT.widthPx,
      height: page.scrollHeight,
    });

    pdfHasPage = appendCanvasToA4Pdf(pdf, canvas, pdfHasPage);
  }

  return pdf.output("blob");
}

function appendCanvasToA4Pdf(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
  pdfHasPage: boolean,
): boolean {
  const pageWidthMm = A4_WIDTH_MM;
  const pageHeightMm = A4_HEIGHT_MM;
  const renderedHeightMm = (canvas.height * pageWidthMm) / canvas.width;

  if (renderedHeightMm <= pageHeightMm + 0.5) {
    if (pdfHasPage) {
      pdf.addPage();
    }
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      pageWidthMm,
      renderedHeightMm,
      undefined,
      "FAST",
    );
    return true;
  }

  const sliceHeightPx = Math.floor((pageHeightMm * canvas.width) / pageWidthMm);
  let offsetY = 0;
  let firstSlice = !pdfHasPage;

  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;

    const context = sliceCanvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to render report page for PDF export.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    context.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    const sliceHeightMm = (sliceHeight * pageWidthMm) / canvas.width;

    if (!firstSlice) {
      pdf.addPage();
    }
    firstSlice = false;

    pdf.addImage(
      sliceCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      pageWidthMm,
      sliceHeightMm,
      undefined,
      "FAST",
    );

    offsetY += sliceHeight;
  }

  return true;
}

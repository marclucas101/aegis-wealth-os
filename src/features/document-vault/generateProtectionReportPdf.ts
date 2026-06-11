const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

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

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];

    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: page.scrollWidth,
      width: page.scrollWidth,
      height: page.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const imgHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;
    const renderHeight = Math.min(imgHeightMm, A4_HEIGHT_MM);

    if (index > 0) {
      pdf.addPage();
    }

    pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, renderHeight, undefined, "FAST");
  }

  return pdf.output("blob");
}

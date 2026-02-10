const { chromium } = require("playwright-chromium");

async function generatePdfFromHtml(html) {
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  await page.setContent(html, {
    waitUntil: "networkidle",
  });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      bottom: "20mm",
      left: "10mm",
      right: "10mm",
    },
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = { generatePdfFromHtml };

const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
  await page.setViewport({ width: 1440, height: 900 });

  console.log("Loading page...");
  await page.goto("https://ecommerce-power-tools.myshopify.com", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));

  // Scroll to trigger all lazy content
  console.log("Scrolling...");
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 3000));

  // Save as MHTML — includes ALL resources (CSS, JS, images, fonts)
  console.log("Saving MHTML...");
  const cdp = await page.createCDPSession();
  const { data } = await cdp.send("Page.captureSnapshot", { format: "mhtml" });

  fs.writeFileSync("/Users/dario61/Desktop/shopify-theme-research/wireframe-builder/extracted/full-page-test.mhtml", data, "utf-8");
  console.log(`Saved MHTML: ${data.length} bytes`);

  await browser.close();
})();

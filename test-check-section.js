const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("https://ecommerce-power-tools.myshopify.com", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));

  // Scroll to trigger lazy load
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 3000));

  const info = await page.evaluate(() => {
    const sections = document.querySelectorAll('[id^="shopify-section"]');
    for (const s of sections) {
      if (s.id.includes("collection_tabs")) {
        const imgs = s.querySelectorAll("img");
        const divs = s.querySelectorAll("div");
        const html = s.innerHTML;
        return {
          id: s.id,
          htmlLength: html.length,
          imgCount: imgs.length,
          divCount: divs.length,
          childCount: s.children.length,
          firstChildTag: s.children[0]?.tagName,
          textPreview: s.textContent?.trim().slice(0, 200),
          hasProducts: html.includes("product") || html.includes("price"),
        };
      }
    }
    return { error: "not found" };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();

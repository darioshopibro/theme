const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

  // Pick Krank since it's our target niche
  await page.goto("https://themes.shopify.com/themes/krank", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  const bodyText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync("/Users/dario61/Desktop/shopify-theme-research/debug-krank-text.txt", bodyText, "utf-8");

  const html = await page.evaluate(() => document.body.innerHTML);
  fs.writeFileSync("/Users/dario61/Desktop/shopify-theme-research/debug-krank-html.txt", html, "utf-8");

  console.log("Done. Body text length:", bodyText.length);
  console.log("HTML length:", html.length);

  await browser.close();
})();

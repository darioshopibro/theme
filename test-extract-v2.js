const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto("https://ecommerce-power-tools.myshopify.com", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Get ALL CSS (stylesheets + inline styles + CSS vars)
  const allCSS = await page.evaluate(() => {
    let css = "";

    // All <style> tags
    for (const style of document.querySelectorAll("style")) {
      css += style.textContent + "\n";
    }

    // All stylesheet rules we can access
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          css += rule.cssText + "\n";
        }
      } catch (e) {}
    }

    return css;
  });

  // Get hero section HTML
  const sectionHTML = await page.evaluate(() => {
    const sections = document.querySelectorAll('[id^="shopify-section"]');
    for (const s of sections) {
      if (s.id.includes("carousel") || s.id.includes("hero")) {
        return s.outerHTML;
      }
    }
    return null;
  });

  // Get external stylesheet URLs (for fonts etc)
  const externalCSS = await page.evaluate(() => {
    return [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href);
  });

  if (!sectionHTML) { console.log("No hero found"); await browser.close(); return; }

  // Build fully self-contained HTML
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${externalCSS.map(url => `<link rel="stylesheet" href="${url}">`).join("\n")}
<style>
${allCSS}
</style>
</head>
<body style="margin:0;padding:0;">
${sectionHTML}
</body>
</html>`;

  fs.writeFileSync("/Users/dario61/Desktop/shopify-theme-research/extracted-hero-full.html", html, "utf-8");
  console.log(`Saved! HTML: ${sectionHTML.length}, CSS: ${allCSS.length}, External sheets: ${externalCSS.length}`);
  console.log("Open extracted-hero-full.html in browser to check");

  await browser.close();
})();

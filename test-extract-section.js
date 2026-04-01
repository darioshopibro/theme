const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto("https://ecommerce-power-tools.myshopify.com", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Extract hero section as self-contained HTML
  const result = await page.evaluate(() => {
    // Get all stylesheets as text
    let allCSS = "";
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          allCSS += rule.cssText + "\n";
        }
      } catch (e) {
        // cross-origin stylesheet, skip
      }
    }

    // Get inline styles from <style> tags
    const inlineStyles = [...document.querySelectorAll("style")].map(s => s.textContent).join("\n");

    // Get CSS custom properties from :root
    const rootStyles = document.querySelector(":root");
    const computed = getComputedStyle(rootStyles);
    const cssVars = {};
    for (const prop of computed) {
      if (prop.startsWith("--")) {
        cssVars[prop] = computed.getPropertyValue(prop).trim();
      }
    }

    // Find the hero/carousel section
    const sections = document.querySelectorAll('[id^="shopify-section"]');
    let heroSection = null;
    for (const s of sections) {
      if (s.id.includes("carousel") || s.id.includes("hero") || s.id.includes("slideshow")) {
        heroSection = s;
        break;
      }
    }

    if (!heroSection) return { error: "No hero found", allSections: [...sections].map(s => s.id) };

    // Get the section HTML
    const sectionHTML = heroSection.outerHTML;

    // Get all fonts used
    const fontLinks = [...document.querySelectorAll('link[rel="stylesheet"][href*="font"]')].map(l => l.href);

    return {
      sectionId: heroSection.id,
      sectionHTML,
      htmlLength: sectionHTML.length,
      cssLength: allCSS.length,
      inlineStylesLength: inlineStyles.length,
      cssVarsCount: Object.keys(cssVars).length,
      cssVarsSample: Object.fromEntries(Object.entries(cssVars).slice(0, 20)),
      fontLinks,
    };
  });

  console.log("Section ID:", result.sectionId);
  console.log("HTML length:", result.htmlLength);
  console.log("CSS length:", result.cssLength);
  console.log("CSS vars:", result.cssVarsCount);
  console.log("Font links:", result.fontLinks?.length);
  console.log("\nCSS vars sample:", JSON.stringify(result.cssVarsSample, null, 2));

  // Save the section HTML to test rendering
  if (result.sectionHTML) {
    // Build a standalone HTML page with the section
    const standalone = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${result.fontLinks?.map(f => `<link rel="stylesheet" href="${f}">`).join("\n") || ""}
<style>
:root {
${Object.entries(result.cssVarsSample || {}).map(([k, v]) => `  ${k}: ${v};`).join("\n")}
}
* { margin: 0; padding: 0; box-sizing: border-box; }
</style>
</head>
<body>
${result.sectionHTML}
</body>
</html>`;

    fs.writeFileSync("/Users/dario61/Desktop/shopify-theme-research/extracted-hero.html", standalone, "utf-8");
    console.log("\nSaved standalone HTML to extracted-hero.html");
  }

  await browser.close();
})();

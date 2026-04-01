const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// --- Config ---
const BASE_URL = "https://themes.shopify.com/themes";
const SORT = "newest";
const DELAY_MIN = 5000;
const DELAY_MAX = 10000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const OUTPUT_DIR = __dirname;
const LOG_FILE = path.join(OUTPUT_DIR, `scrape_full_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`);

// --- Helpers ---
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function randomDelay() { return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN)) + DELAY_MIN; }
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
}

// --- Extract theme data from theme page ---
async function extractThemeData(page, slug) {
  return await page.evaluate((slug) => {
    const bodyText = document.body.innerText;

    const h1 = document.querySelector("h1");
    const name = h1 ? h1.textContent.trim() : slug;

    const priceMatch = bodyText.match(/\$(\d+)\s*USD/);
    const price = priceMatch ? `$${priceMatch[1]}` : "Free";

    const reviewMatch = bodyText.match(/(\d+)%\s*positive\s+(\d+)\s*review/i);
    const ratingPercent = reviewMatch ? parseInt(reviewMatch[1]) : null;
    const reviewCount = reviewMatch ? parseInt(reviewMatch[2]) : 0;

    // Review breakdown
    const posMatch = bodyText.match(/Positive reviews\s*\n\s*(\d+)/i);
    const neutralMatch = bodyText.match(/Neutral reviews\s*\n\s*(\d+)/i);
    const negMatch = bodyText.match(/Negative reviews\s*\n\s*(\d+)/i);
    const reviewBreakdown = {
      positive: posMatch ? parseInt(posMatch[1]) : null,
      neutral: neutralMatch ? parseInt(neutralMatch[1]) : null,
      negative: negMatch ? parseInt(negMatch[1]) : null,
    };

    // Features
    const features = {};
    const featuresSection = bodyText.match(/WHAT'S INCLUDED\s*\n\s*Features\s*\n([\s\S]*?)(?=Presets\n|Reviews\n|$)/i);
    if (featuresSection) {
      const lines = featuresSection[1].split("\n").map(l => l.trim()).filter(Boolean);
      const categories = ["Cart and checkout", "Marketing and conversion", "Merchandising", "Product discovery"];
      let currentCat = "other";
      for (const line of lines) {
        if (categories.some(c => line.toLowerCase() === c.toLowerCase())) {
          currentCat = line;
          features[currentCat] = [];
        } else if (currentCat && features[currentCat]) {
          features[currentCat].push(line);
        } else {
          if (!features["other"]) features["other"] = [];
          features["other"].push(line);
        }
      }
    }

    // Presets count + names
    const presetsMatch = bodyText.match(/comes with (\d+) ready-made/i);
    const presetCount = presetsMatch ? parseInt(presetsMatch[1]) : null;
    const presetNames = [];
    const presetImgs = document.querySelectorAll('img[alt*="previews"]');
    const seenPresets = new Set();
    for (const img of presetImgs) {
      const alt = img.getAttribute("alt");
      const match = alt.match(/previews\s+(.+)/i);
      if (match && !seenPresets.has(match[1])) {
        seenPresets.add(match[1]);
        presetNames.push(match[1]);
      }
    }

    // Developer
    const devMatch = bodyText.match(/Designed by\s+([^\n]+)/i);
    const developer = devMatch ? devMatch[1].trim() : null;

    // Launch date
    const allDates = bodyText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi) || [];
    const launchDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;

    // Demo URL
    const demoSection = document.querySelector('[data-demo-store-iframe-url-value]');
    const demoUrl = demoSection ? demoSection.getAttribute('data-demo-store-iframe-url-value') : null;

    // Niches
    const nicheMatch = bodyText.match(/More themes for (.+?)(?:\n|$)/i);
    const niche = nicheMatch ? nicheMatch[1].trim() : null;
    const industries = [];
    const designedForMatch = bodyText.match(/(?:Designed for|Best for|Suitable for)[:\s]+([^\n]+)/i);
    if (designedForMatch) industries.push(designedForMatch[1].trim());
    if (niche && !industries.includes(niche)) industries.push(niche);

    return {
      name, slug, price, reviewCount, ratingPercent, reviewBreakdown,
      launchDate, niches: industries, features, presetCount, presetNames,
      developer, demoUrl, url: window.location.href,
    };
  }, slug);
}

// --- Extract sections from demo store ---
async function extractDemoSections(page, demoUrl) {
  const sections = { homepage: [], collection: [], product: [] };

  const extractSections = async () => {
    return await page.evaluate(() => {
      const sectionEls = document.querySelectorAll('[id^="shopify-section"]');
      return [...sectionEls].map(el => {
        const id = el.id;
        const typeMatch = id.match(/__(.+)$/);
        const type = typeMatch ? typeMatch[1] : id.replace("shopify-section-", "");
        const heading = el.querySelector("h1, h2, h3");
        return {
          type,
          heading: heading ? heading.textContent.trim().slice(0, 60) : null,
          visible: el.offsetHeight > 0,
        };
      });
    });
  };

  try {
    // Homepage
    await page.goto(demoUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);
    sections.homepage = await extractSections();

    // Collection
    await page.goto(demoUrl + "/collections/all", { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    sections.collection = await extractSections();

    // Product — find first product link
    const productUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/products/"]');
      return link ? link.href : null;
    });
    if (productUrl) {
      await page.goto(productUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await sleep(1500);
      sections.product = await extractSections();
    }
  } catch (err) {
    log(`    DEMO ERROR: ${err.message}`);
  }

  return sections;
}

// --- Main ---
async function scrapeAll() {
  log("========================================");
  log("FULL SHOPIFY THEME STORE SCRAPER");
  log("========================================");
  log(`Scraping ALL themes (no review limit)`);
  log(`Delay: ${DELAY_MIN/1000}-${DELAY_MAX/1000}s`);
  log(`Log: ${LOG_FILE}`);
  log("");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const allThemes = [];
  const seenSlugs = new Set();
  let pageNum = 1;
  let totalSkipped = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  try {
    while (true) {
      const url = `${BASE_URL}?sort_by=${SORT}&page=${pageNum}`;
      log(`\n========================================`);
      log(`LISTING PAGE ${pageNum}: ${url}`);
      log(`========================================`);
      log(`Themes: ${allThemes.length} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`);

      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(2000);

      const pageTitle = await page.title();
      log(`Page title: "${pageTitle}"`);

      const themeCards = await page.evaluate(() => {
        const cards = [];
        const links = document.querySelectorAll('a[href*="/themes/"][href*="/presets/"]');
        const seen = new Set();
        for (const link of links) {
          const href = link.getAttribute("href");
          const match = href.match(/\/themes\/([^/]+)\/presets\//);
          if (!match) continue;
          const slug = match[1];
          if (seen.has(slug)) continue;
          seen.add(slug);
          cards.push({ slug });
        }
        return cards;
      });

      if (themeCards.length === 0) {
        log("NO THEME CARDS — end of store or blocked.");
        const screenshotPath = path.join(OUTPUT_DIR, `debug_page${pageNum}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log(`Debug screenshot: ${screenshotPath}`);
        break;
      }

      log(`Found ${themeCards.length} themes: ${themeCards.map(c => c.slug).join(", ")}`);

      for (let i = 0; i < themeCards.length; i++) {
        const card = themeCards[i];

        if (seenSlugs.has(card.slug)) {
          log(`  [${i+1}/${themeCards.length}] SKIP "${card.slug}" — duplicate`);
          totalSkipped++;
          continue;
        }
        seenSlugs.add(card.slug);

        const delay = randomDelay();
        log(`  [${i+1}/${themeCards.length}] Waiting ${(delay/1000).toFixed(1)}s → ${card.slug}`);
        await sleep(delay);

        try {
          // --- Theme page ---
          const themeUrl = `https://themes.shopify.com/themes/${card.slug}`;
          const t0 = Date.now();
          await page.goto(themeUrl, { waitUntil: "networkidle2", timeout: 60000 });
          await sleep(1500);
          log(`    Theme page loaded in ${Date.now()-t0}ms`);

          const themeData = await extractThemeData(page, card.slug);
          const featureCount = Object.values(themeData.features).reduce((a, b) => a + b.length, 0);
          log(`    ✓ ${themeData.name} | ${themeData.price} | ${themeData.reviewCount} rev | ${themeData.ratingPercent}% | ${featureCount} features | ${themeData.presetCount || "?"} presets | ${themeData.developer || "?"}`);
          log(`    breakdown: +${themeData.reviewBreakdown.positive} ~${themeData.reviewBreakdown.neutral} -${themeData.reviewBreakdown.negative} | niches: ${themeData.niches.join(", ") || "n/a"} | launch: ${themeData.launchDate || "?"}`);
          log(`    presets: ${themeData.presetNames.join(", ") || "?"} | demo: ${themeData.demoUrl || "none"}`);

          // --- Demo sections ---
          if (themeData.demoUrl) {
            log(`    Scraping demo sections: ${themeData.demoUrl}`);
            const t1 = Date.now();
            const sections = await extractDemoSections(page, themeData.demoUrl);
            const hpCount = sections.homepage.filter(s => s.visible).length;
            const colCount = sections.collection.filter(s => s.visible).length;
            const prodCount = sections.product.filter(s => s.visible).length;
            log(`    Demo scraped in ${Date.now()-t1}ms — HP: ${hpCount} sections | Collection: ${colCount} | Product: ${prodCount}`);
            themeData.sections = sections;
          } else {
            log(`    No demo URL found — skipping sections`);
            themeData.sections = { homepage: [], collection: [], product: [] };
          }

          allThemes.push(themeData);
          log(`    TOTAL: ${allThemes.length} unique themes`);

        } catch (err) {
          totalErrors++;
          log(`    ✗ ERROR on ${card.slug}: ${err.message}`);
          allThemes.push({
            name: card.slug, slug: card.slug, price: null, reviewCount: null,
            ratingPercent: null, reviewBreakdown: {}, launchDate: null, niches: [],
            features: {}, presetCount: null, presetNames: [], developer: null,
            demoUrl: null, sections: {}, url: `https://themes.shopify.com/themes/${card.slug}`,
            error: err.message,
          });
        }
      }

      pageNum++;
      const delay = randomDelay();
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      log(`\n--- Page ${pageNum-1} done | ${allThemes.length} themes | ${elapsed} min | waiting ${(delay/1000).toFixed(1)}s ---`);
      await sleep(delay);
    }
  } finally {
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    log(`\n========================================`);
    log(`SCRAPE FINISHED`);
    log(`Total time: ${totalTime} minutes`);
    log(`Total unique themes: ${allThemes.length}`);
    log(`Duplicates skipped: ${totalSkipped}`);
    log(`Errors: ${totalErrors}`);
    log(`Pages scraped: ${pageNum}`);
    log(`========================================`);
    await browser.close();
    log("Browser closed");
  }

  return allThemes;
}

// --- Save ---
function saveJSON(data, filename) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  log(`Saved JSON: ${filepath} (${data.length} themes)`);
}

// --- Run ---
(async () => {
  try {
    const themes = await scrapeAll();
    if (themes.length === 0) { log("No themes scraped."); return; }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    saveJSON(themes, `themes_full_${timestamp}.json`);

    log("");
    log("========================================");
    log("FINAL SUMMARY");
    log("========================================");
    log(`Total: ${themes.length}`);
    log(`With reviews: ${themes.filter(t => t.reviewCount > 0).length}`);
    log(`Without reviews: ${themes.filter(t => t.reviewCount === 0).length}`);
    log(`With errors: ${themes.filter(t => t.error).length}`);
    log(`With demo sections: ${themes.filter(t => t.sections && t.sections.homepage && t.sections.homepage.length > 0).length}`);
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
})();

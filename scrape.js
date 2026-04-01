const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// --- Config ---
const BASE_URL = "https://themes.shopify.com/themes";
const SORT = "newest";
const MIN_REVIEWS_STOP = 150; // stop when a theme has 150+ reviews
const DELAY_MIN = 5000;
const DELAY_MAX = 10000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const OUTPUT_DIR = __dirname;
const LOG_FILE = path.join(OUTPUT_DIR, `scrape_log_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`);

// --- Helpers ---
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay() {
  return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN)) + DELAY_MIN;
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
}

// --- Main scraper ---
async function scrapeThemeStore() {
  log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  log("Browser launched OK");

  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1440, height: 900 });
  log(`User agent: ${USER_AGENT}`);
  log(`Viewport: 1440x900`);

  // Log all HTTP responses
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (url.includes("themes.shopify.com")) {
      log(`  [HTTP ${status}] ${url.slice(0, 120)}`);
      if (status >= 400) {
        log(`  ⚠ WARNING: Got HTTP ${status} on ${url}`);
      }
    }
  });

  // Log page errors
  page.on("pageerror", (err) => {
    log(`  [PAGE ERROR] ${err.message}`);
  });

  // Hide webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const allThemes = [];
  const seenSlugs = new Set(); // deduplicate across pages
  let pageNum = 1;
  let shouldStop = false;
  let totalSkipped = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  try {
    while (!shouldStop) {
      const url = `${BASE_URL}?sort_by=${SORT}&page=${pageNum}`;
      log(`\n========================================`);
      log(`LISTING PAGE ${pageNum}: ${url}`);
      log(`========================================`);
      log(`Themes collected so far: ${allThemes.length} | Duplicates skipped: ${totalSkipped} | Errors: ${totalErrors}`);

      const navStart = Date.now();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      log(`Page loaded in ${Date.now() - navStart}ms`);
      await sleep(2000);

      // Check page title to detect blocks/captchas
      const pageTitle = await page.title();
      log(`Page title: "${pageTitle}"`);

      const bodyLength = await page.evaluate(() => document.body.innerText.length);
      log(`Page body text length: ${bodyLength} chars`);

      // Extract theme links and basic info from listing page
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

          const text = link.textContent.trim();
          cards.push({ slug, text, href });
        }
        return cards;
      });

      if (themeCards.length === 0) {
        log("NO THEME CARDS FOUND on this page.");
        // Save screenshot for debugging
        const screenshotPath = path.join(OUTPUT_DIR, `debug_page${pageNum}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log(`Saved debug screenshot: ${screenshotPath}`);
        log("Stopping - possible end of results or site block.");
        break;
      }

      log(`Found ${themeCards.length} theme cards on page: ${themeCards.map((c) => c.slug).join(", ")}`);

      // Visit each theme's detail page to get full info
      for (let i = 0; i < themeCards.length; i++) {
        const card = themeCards[i];

        // Deduplicate
        if (seenSlugs.has(card.slug)) {
          log(`  [${i + 1}/${themeCards.length}] SKIP "${card.slug}" - already scraped`);
          totalSkipped++;
          continue;
        }
        seenSlugs.add(card.slug);

        const themeUrl = `https://themes.shopify.com/themes/${card.slug}`;
        const delay = randomDelay();
        log(`  [${i + 1}/${themeCards.length}] Waiting ${(delay / 1000).toFixed(1)}s then visiting: ${card.slug}`);
        await sleep(delay);

        try {
          const detailStart = Date.now();
          await page.goto(themeUrl, { waitUntil: "networkidle2", timeout: 60000 });
          await sleep(1500);
          log(`    Page loaded in ${Date.now() - detailStart}ms`);

          // Check for redirect or unexpected page
          const currentUrl = page.url();
          if (!currentUrl.includes(card.slug)) {
            log(`    ⚠ REDIRECTED to: ${currentUrl} (expected ${card.slug})`);
          }

          const themeData = await page.evaluate((slug) => {
            const bodyText = document.body.innerText;

            const h1 = document.querySelector("h1");
            const name = h1 ? h1.textContent.trim() : slug;

            const priceMatch = bodyText.match(/\$(\d+)\s*USD/);
            const price = priceMatch ? `$${priceMatch[1]}` : "Free";

            const reviewMatch = bodyText.match(/(\d+)%\s*positive\s+(\d+)\s*review/i);
            const ratingPercent = reviewMatch ? parseInt(reviewMatch[1]) : null;
            const reviewCount = reviewMatch ? parseInt(reviewMatch[2]) : 0;

            // Extract launch/listed date - try multiple patterns
            let launchDate = null;

            // Pattern 1: "Listed <date>" or "Listed on <date>"
            const listedMatch = bodyText.match(/Listed(?:\s+on)?\s+([A-Z][a-z]+ \d{1,2},?\s*\d{4})/i);
            if (listedMatch) launchDate = listedMatch[1].trim();

            // Pattern 2: "Published <date>"
            if (!launchDate) {
              const pubMatch = bodyText.match(/Published(?:\s+on)?\s+([A-Z][a-z]+ \d{1,2},?\s*\d{4})/i);
              if (pubMatch) launchDate = pubMatch[1].trim();
            }

            // Pattern 3: "Added <date>"
            if (!launchDate) {
              const addedMatch = bodyText.match(/Added(?:\s+on)?\s+([A-Z][a-z]+ \d{1,2},?\s*\d{4})/i);
              if (addedMatch) launchDate = addedMatch[1].trim();
            }

            // Pattern 4: Look for "Month DD, YYYY" near "Latest update" or standalone dates
            if (!launchDate) {
              const datePattern = bodyText.match(/(?:launch|release|since|from)\s+([A-Z][a-z]+ \d{1,2},?\s*\d{4})/i);
              if (datePattern) launchDate = datePattern[1].trim();
            }

            // Pattern 5: Try to find any "Month DD, YYYY" pattern near key terms
            if (!launchDate) {
              const allDates = bodyText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi);
              if (allDates) launchDate = allDates[allDates.length - 1]; // last date is usually the oldest/launch
            }

            // Also grab "Latest update" date
            let latestUpdate = null;
            const updateMatch = bodyText.match(/Latest update\s*[:\-]?\s*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/i);
            if (updateMatch) latestUpdate = updateMatch[1].trim();
            if (!latestUpdate) {
              const updateMatch2 = bodyText.match(/(?:Last updated|Updated)\s*[:\-]?\s*([A-Z][a-z]+ \d{1,2},?\s*\d{4})/i);
              if (updateMatch2) latestUpdate = updateMatch2[1].trim();
            }

            // Grab ALL dates found on page for debugging
            const allDatesFound = bodyText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi) || [];

            const nicheMatch = bodyText.match(/More themes for (.+?)(?:\n|$)/i);
            const niche = nicheMatch ? nicheMatch[1].trim() : null;

            const allText = bodyText;
            const industries = [];

            const designedForMatch = allText.match(/(?:Designed for|Best for|Suitable for)[:\s]+([^\n]+)/i);
            if (designedForMatch) {
              industries.push(designedForMatch[1].trim());
            }
            if (niche && !industries.includes(niche)) {
              industries.push(niche);
            }

            return {
              name,
              slug,
              price,
              reviewCount,
              ratingPercent,
              launchDate,
              latestUpdate,
              allDatesFound,
              niches: industries,
              url: window.location.href,
              bodyTextLength: bodyText.length,
            };
          }, card.slug);

          const { bodyTextLength, allDatesFound, ...cleanData } = themeData;
          allThemes.push(cleanData);

          log(`    ✓ ${themeData.name} | ${themeData.price} | ${themeData.reviewCount} reviews | ${themeData.ratingPercent}% | niches: ${themeData.niches.join(", ") || "n/a"} | body: ${bodyTextLength} chars`);
          log(`    DATES: launch=${themeData.launchDate || "NOT FOUND"} | update=${themeData.latestUpdate || "NOT FOUND"} | all dates on page: [${allDatesFound.join(", ")}]`);
          log(`    TOTAL so far: ${allThemes.length} unique themes`);

          if (themeData.reviewCount >= MIN_REVIEWS_STOP) {
            log(`\n>>> STOP CONDITION: "${themeData.name}" has ${themeData.reviewCount} reviews (>= ${MIN_REVIEWS_STOP})`);
            shouldStop = true;
            break;
          }
        } catch (err) {
          totalErrors++;
          log(`    ✗ ERROR on ${card.slug}: ${err.message}`);
          allThemes.push({
            name: card.slug,
            slug: card.slug,
            price: null,
            reviewCount: null,
            ratingPercent: null,
            niches: [],
            url: `https://themes.shopify.com/themes/${card.slug}`,
            error: err.message,
          });
        }
      }

      if (!shouldStop) {
        pageNum++;
        const delay = randomDelay();
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        log(`\n--- Page ${pageNum - 1} done | ${allThemes.length} themes | ${elapsed} min elapsed | waiting ${(delay / 1000).toFixed(1)}s ---`);
        await sleep(delay);
      }
    }
  } finally {
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    log(`\n========================================`);
    log(`SCRAPE FINISHED`);
    log(`Total time: ${totalTime} minutes`);
    log(`Total unique themes: ${allThemes.length}`);
    log(`Total duplicates skipped: ${totalSkipped}`);
    log(`Total errors: ${totalErrors}`);
    log(`Pages scraped: ${pageNum}`);
    log(`========================================`);
    await browser.close();
    log("Browser closed");
  }

  return allThemes;
}

// --- Save results ---
function saveJSON(data, filename) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  log(`Saved JSON: ${filepath} (${data.length} themes)`);
}

function saveCSV(data, filename) {
  const headers = ["name", "slug", "price", "reviewCount", "ratingPercent", "launchDate", "latestUpdate", "niches", "url"];
  const csvRows = [headers.join(",")];

  for (const row of data) {
    const values = headers.map((h) => {
      let val = row[h];
      if (Array.isArray(val)) val = val.join("; ");
      if (val === null || val === undefined) val = "";
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    });
    csvRows.push(values.join(","));
  }

  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, csvRows.join("\n"), "utf-8");
  log(`Saved CSV: ${filepath} (${data.length} themes)`);
}

// --- Run ---
(async () => {
  log("========================================");
  log("SHOPIFY THEME STORE SCRAPER");
  log("========================================");
  log(`Stop condition: ${MIN_REVIEWS_STOP}+ reviews`);
  log(`Delay between requests: ${DELAY_MIN / 1000}-${DELAY_MAX / 1000}s`);
  log(`Log file: ${LOG_FILE}`);
  log("");

  try {
    const themes = await scrapeThemeStore();

    if (themes.length === 0) {
      log("No themes scraped. Check if the site structure has changed.");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    saveJSON(themes, `themes_${timestamp}.json`);
    saveCSV(themes, `themes_${timestamp}.csv`);

    log("");
    log("========================================");
    log("FINAL SUMMARY");
    log("========================================");
    log(`Total themes: ${themes.length}`);
    log(`With reviews: ${themes.filter((t) => t.reviewCount > 0).length}`);
    log(`Without reviews: ${themes.filter((t) => t.reviewCount === 0).length}`);
    log(`With errors: ${themes.filter((t) => t.error).length}`);
    log(`Price range: ${themes.filter((t) => t.price).map((t) => t.price).join(", ")}`);
    log(`Log saved to: ${LOG_FILE}`);
  } catch (err) {
    log(`FATAL ERROR: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
})();

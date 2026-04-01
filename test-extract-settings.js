const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("https://ecommerce-power-tools.myshopify.com", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  const settings = await page.evaluate(() => {
    // Get CSS custom properties from :root
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const cssVars = {};
    // Try common Shopify theme variable names
    const varNames = [
      '--color-foreground', '--color-background', '--color-primary', '--color-secondary',
      '--color-accent', '--color-base-text', '--color-base-background',
      '--font-heading-family', '--font-body-family',
      '--font-heading-weight', '--font-body-weight',
      '--font-heading-style', '--font-body-style',
      '--font-heading-scale', '--font-body-scale',
      '--page-width',
      '--buttons-radius', '--buttons-border-width',
      '--inputs-radius', '--inputs-border-width',
      '--card-corner-radius', '--card-border-width',
      '--card-shadow-opacity', '--card-shadow-blur-radius', '--card-shadow-vertical-offset',
      '--badge-corner-radius',
      '--spacing-sections-desktop', '--spacing-sections-mobile',
      '--duration-short', '--duration-default', '--duration-long',
      '--grid-desktop-horizontal-spacing', '--grid-mobile-horizontal-spacing',
    ];
    for (const name of varNames) {
      const val = computed.getPropertyValue(name).trim();
      if (val) cssVars[name] = val;
    }

    // Also grab ALL custom properties
    const allVars = {};
    for (const prop of computed) {
      if (prop.startsWith('--')) {
        const val = computed.getPropertyValue(prop).trim();
        if (val) allVars[prop] = val;
      }
    }

    // Get computed styles from key elements
    const body = document.body;
    const bodyStyles = getComputedStyle(body);
    const h1 = document.querySelector('h1');
    const h1Styles = h1 ? getComputedStyle(h1) : null;
    const btn = document.querySelector('button, .btn, a.button, [class*="button"]');
    const btnStyles = btn ? getComputedStyle(btn) : null;
    const card = document.querySelector('[class*="card"], [class*="product"]');
    const cardStyles = card ? getComputedStyle(card) : null;

    return {
      cssVars,
      allVarsCount: Object.keys(allVars).length,
      allVarsSample: Object.fromEntries(Object.entries(allVars).slice(0, 30)),
      body: {
        fontFamily: bodyStyles.fontFamily.slice(0, 80),
        fontSize: bodyStyles.fontSize,
        color: bodyStyles.color,
        backgroundColor: bodyStyles.backgroundColor,
      },
      h1: h1Styles ? {
        fontFamily: h1Styles.fontFamily.slice(0, 80),
        fontSize: h1Styles.fontSize,
        fontWeight: h1Styles.fontWeight,
        color: h1Styles.color,
      } : null,
      button: btnStyles ? {
        borderRadius: btnStyles.borderRadius,
        padding: btnStyles.padding,
        fontWeight: btnStyles.fontWeight,
        textTransform: btnStyles.textTransform,
        backgroundColor: btnStyles.backgroundColor,
        color: btnStyles.color,
      } : null,
      card: cardStyles ? {
        borderRadius: cardStyles.borderRadius,
        boxShadow: cardStyles.boxShadow?.slice(0, 100),
        border: cardStyles.border,
      } : null,
    };
  });

  console.log(JSON.stringify(settings, null, 2));
  await browser.close();
})();

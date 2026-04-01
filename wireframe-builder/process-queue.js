#!/usr/bin/env node
// Process a queued section analysis request
// Usage: node process-queue.js <request-id>
// Or pipe: echo '{"tool_input":{"file_path":"queue/req-xxx.json"}}' | node process-queue.js

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const QUEUE_DIR = path.join(__dirname, 'queue');
const EXTRACTED_DIR = path.join(__dirname, 'extracted');
const PORT = 3007;

async function processRequest(reqId) {
  const reqPath = path.join(QUEUE_DIR, `${reqId}.json`);
  const resultPath = path.join(QUEUE_DIR, `${reqId}-result.json`);

  if (fs.existsSync(resultPath)) {
    console.log(`Already processed: ${reqId}`);
    return;
  }

  if (!fs.existsSync(reqPath)) {
    console.error(`Request not found: ${reqId}`);
    return;
  }

  const request = JSON.parse(fs.readFileSync(reqPath, 'utf-8'));
  const { sectionType, themeSettings, targetPage, sourceFile } = request;

  console.log(`Processing: ${reqId} (${sectionType} → ${targetPage})`);

  // If we have the source file, analyze it with Puppeteer
  let analysis = { detectedType: sectionType, settings: {}, meta: {} };

  if (sourceFile && fs.existsSync(path.join(EXTRACTED_DIR, sourceFile))) {
    try {
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 3000 });
      await page.goto(`http://localhost:${PORT}/extracted/${sourceFile}`, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));

      analysis = await page.evaluate(`
        (function() {
          var body = document.body;
          var productCards = body.querySelectorAll('[class*="product-card"], [class*="product_card"], .card, [class*="grid-item"]');
          var productsCount = productCards.length;

          var columns = 4;
          var firstRow = [];
          var firstY = null;
          for (var i = 0; i < productCards.length && i < 20; i++) {
            var rect = productCards[i].getBoundingClientRect();
            if (firstY === null) firstY = rect.top;
            if (Math.abs(rect.top - firstY) < 20) firstRow.push(1);
            else break;
          }
          if (firstRow.length > 0) columns = firstRow.length;

          var h1 = body.querySelector('h1, h2, h3');
          var heading = h1 ? h1.textContent.trim().slice(0, 60) : '';

          var sub = h1 ? h1.nextElementSibling : null;
          var subheading = '';
          if (sub && (sub.tagName === 'P' || sub.tagName === 'SPAN')) {
            subheading = sub.textContent.trim().slice(0, 80);
          }

          var btn = body.querySelector('button, a.btn, [class*="button"]');
          var buttonText = btn ? btn.textContent.trim().slice(0, 30) : '';

          var sType = 'rich-text';
          if (productsCount > 2) sType = 'featured-collection';
          else if (body.querySelector('[class*="hero"], [class*="banner"], [class*="carousel"]')) sType = 'hero';
          else if (body.querySelector('[class*="testimonial"], [class*="review"]')) sType = 'testimonials';
          else if (body.querySelectorAll('input[type="email"]').length > 0) sType = 'newsletter';
          else if (body.querySelectorAll('[class*="blog"], article').length > 0) sType = 'featured-blog';
          else if (body.querySelectorAll('[class*="logo"]').length > 3) sType = 'logo-list';
          else if (columns > 1) sType = 'multicolumn';

          var height = Math.round(body.scrollHeight);

          return {
            detectedType: sType,
            settings: {
              heading: heading,
              subheading: subheading,
              columns: columns,
              products_count: productsCount || columns,
              button_text: buttonText,
              image_ratio: '1:1',
              text_align: 'center',
              show_price: productsCount > 0,
              show_vendor: false,
            },
            meta: { productsCount: productsCount, height: height }
          };
        })()
      `);

      await browser.close();
    } catch (e) {
      console.error('Puppeteer analysis failed:', e.message);
    }
  }

  // Generate result
  const result = {
    id: reqId,
    status: 'done',
    wireframeSection: {
      type: analysis.detectedType || sectionType || 'rich-text',
      heading: analysis.settings?.heading || '',
      settings: {
        heading: analysis.settings?.heading || '',
        subheading: analysis.settings?.subheading || '',
        columns: analysis.settings?.columns || 4,
        products_count: analysis.settings?.products_count || 4,
        button_text: analysis.settings?.button_text || 'Shop Now',
        button_style: 'solid',
        image_ratio: analysis.settings?.image_ratio || '1:1',
        text_align: analysis.settings?.text_align || 'center',
        show_price: analysis.settings?.show_price !== false,
        show_vendor: false,
      },
    },
    recommendedThemeChanges: {},
    analysis: `Auto-analyzed ${sectionType}: ${analysis.detectedType}, ${analysis.settings?.columns || '?'} columns, ${analysis.meta?.productsCount || 0} products, height ${analysis.meta?.height || '?'}px`,
  };

  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Done: ${resultPath}`);

  // Output for hook
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Section analysis complete for ${reqId}: type=${result.wireframeSection.type}, ${result.wireframeSection.settings.columns} cols, ${result.wireframeSection.settings.products_count} products`
    }
  }));
}

// Get request ID from args or stdin
const args = process.argv.slice(2);
if (args[0]) {
  processRequest(args[0]).catch(console.error);
} else {
  // Read from stdin (hook mode)
  let input = '';
  process.stdin.on('data', d => input += d);
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const filePath = data.tool_input?.file_path || data.tool_response?.filePath || '';
      const match = filePath.match(/req-(\d+)\.json$/);
      if (match && !filePath.includes('-result')) {
        processRequest(`req-${match[1]}`).catch(console.error);
      }
    } catch (e) {}
  });
}

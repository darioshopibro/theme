#!/usr/bin/env node
// Process a queued section analysis request — extracts REAL content blocks from HTML
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const QUEUE_DIR = path.join(__dirname, 'queue');
const EXTRACTED_DIR = path.join(__dirname, 'extracted');

function analyzeHtml(html, originalType) {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;

  // ── Section-level heading ──
  const sectionHeading = body.querySelector('[class*="section-title"], [class*="section-heading"], [class*="section_title"]');
  const h = sectionHeading || body.querySelector('h1, h2, h3');
  let heading = '';
  if (h) {
    const isCard = h.closest('[class*="card"], [class*="product"], [class*="grid-item"], [class*="slider-slide"]');
    if (!isCard) heading = h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
  }

  // ── Section-level subheading ──
  let subheading = '';
  if (h && heading) {
    const next = h.nextElementSibling;
    if (next && ['P', 'SPAN', 'DIV'].includes(next.tagName)) {
      const isCard = next.closest('[class*="card"], [class*="product"], [class*="grid-item"]');
      if (!isCard) {
        const text = next.textContent.trim().replace(/\s+/g, ' ');
        // Skip if it's just "Read More" type toggles
        const cleaned = text.replace(/Read\s*(More|Less)\s*/gi, '').trim();
        if (cleaned.length > 5 && cleaned.length < 120) {
          subheading = cleaned.slice(0, 80);
        }
      }
    }
  }

  // ── Extract content blocks (the actual items/columns/cards) ──
  // Find repeating items: grid items, slider slides, cards, columns
  const itemSelectors = [
    'li[class*="slider-slide"][class*="grid-item"]',
    'li[class*="grid-item"]',
    '[class*="grid__item"]',
    '[class*="multicolumn"] > ul > li',
    '[class*="card-grid"] > *',
  ];

  let items = [];
  for (const sel of itemSelectors) {
    const found = body.querySelectorAll(sel);
    if (found.length >= 2) {
      items = Array.from(found);
      break;
    }
  }

  // Fallback: look for direct children of a grid/slider wrapper
  if (items.length < 2) {
    const wrapper = body.querySelector('[class*="slider-wrapper"], [class*="grid"], ul[class*="grid"]');
    if (wrapper) {
      const children = Array.from(wrapper.children).filter(c =>
        c.tagName === 'LI' || c.classList.toString().includes('item') || c.classList.toString().includes('slide') || c.classList.toString().includes('col')
      );
      if (children.length >= 2) items = children;
    }
  }

  const blocks = [];
  for (const item of items) {
    const blockHeading = item.querySelector('h1, h2, h3, h4, h5, [class*="title"], [class*="heading"]');
    const blockDesc = item.querySelector('p, [class*="desc"], [class*="rte"], [class*="text"]');
    const blockBtn = item.querySelector('a, button, [class*="button"]');
    const blockImg = item.querySelector('img');

    const bh = blockHeading ? blockHeading.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) : '';
    let bb = '';
    if (blockBtn) {
      bb = blockBtn.textContent.trim().replace(/\s+/g, ' ');
      if (bb.length > 30 || bb.length < 1) bb = '';
    }
    let bd = '';
    if (blockDesc) {
      bd = blockDesc.textContent.trim().replace(/\s+/g, ' ');
      if (bh && bd.startsWith(bh)) bd = bd.slice(bh.length).trim();
      if (bb && bd.endsWith(bb)) bd = bd.slice(0, -bb.length).trim();
      bd = bd.slice(0, 100);
    }

    if (bh || bd) {
      blocks.push({
        heading: bh,
        description: bd,
        button_text: bb,
        has_image: !!blockImg,
      });
    }
  }

  // ── Section-level button (not inside items) ──
  let buttonText = '';
  const btns = body.querySelectorAll('button, a.btn, [class*="button"], .btn');
  for (const btn of btns) {
    const isCard = btn.closest('[class*="card"], [class*="product"], [class*="grid-item"], [class*="slider-slide"]');
    if (isCard) continue;
    const text = btn.textContent.trim().replace(/\s+/g, ' ');
    if (text.length >= 2 && text.length <= 30 && !text.match(/Read (More|Less)/i)) {
      buttonText = text;
      break;
    }
  }

  // ── Product cards (separate from generic blocks) ──
  const productCards = body.querySelectorAll(
    '[class*="product-card"], [class*="product_card"], [class*="product-item"], ' +
    '[class*="grid-product"], [class*="card-product"], [class*="product__card"]'
  );
  const productsCount = productCards.length;

  // ── Columns count ──
  let columns = blocks.length || items.length || 4;
  if (columns > 6) columns = 4; // cap

  // ── Image ratio ──
  let imageRatio = '1:1';
  const img = body.querySelector('img');
  if (img) {
    const w = parseInt(img.getAttribute('width') || '0');
    const ih = parseInt(img.getAttribute('height') || '0');
    if (w > 0 && ih > 0) {
      const ratio = w / ih;
      if (ratio > 1.5) imageRatio = '16:9';
      else if (ratio > 1.2) imageRatio = '4:3';
      else if (ratio < 0.85) imageRatio = '3:4';
    }
  }

  // ── Tab labels ──
  let tabLabels = [];
  if (!heading) {
    const tabItems = body.querySelectorAll('li.tab, li[class*="tab"], [role="tab"]');
    tabItems.forEach(t => {
      const text = t.textContent.trim();
      if (text.length > 1 && text.length < 40) tabLabels.push(text);
    });
    if (tabLabels.length >= 2) heading = tabLabels.slice(0, 4).join(' | ');
  }

  // ── Type detection ──
  let detectedType = originalType || 'rich-text';

  // Only override if originalType is generic/unknown
  if (!originalType || originalType === 'unknown' || originalType === 'imported') {
    const hasHero = body.querySelector('[class*="hero"], [class*="banner"], [class*="slideshow"]');
    const hasCarousel = body.querySelector('[class*="carousel"], [class*="slider"], [class*="swiper"]');
    const hasTestimonial = body.querySelector('[class*="testimonial"], [class*="review"], [class*="quote"]');
    const hasNewsletter = body.querySelector('input[type="email"], [class*="newsletter"], [class*="subscribe"]');
    const hasBlog = body.querySelector('[class*="blog"], [class*="article"], article');
    const hasLogo = body.querySelectorAll('[class*="logo"]');
    const hasVideo = body.querySelector('[class*="video"], video, iframe[src*="youtube"], iframe[src*="vimeo"]');
    const hasTabs = body.querySelector('[class*="tab"], [role="tablist"]');
    const hasMedia = body.querySelector('[class*="media-with-text"], [class*="image-with-text"]');
    const hasCountdown = body.querySelector('[class*="countdown"], [class*="timer"]');

    if (hasHero && !productsCount) detectedType = 'hero';
    else if (hasTabs && productsCount > 2) detectedType = 'collection-tabs';
    else if (productsCount > 2) detectedType = 'featured-collection';
    else if (hasMedia) detectedType = 'media-with-text';
    else if (hasTestimonial) detectedType = 'testimonials';
    else if (hasNewsletter) detectedType = 'newsletter';
    else if (hasBlog) detectedType = 'featured-blog';
    else if (hasLogo.length > 3) detectedType = 'logo-list';
    else if (hasVideo) detectedType = 'video';
    else if (hasCountdown) detectedType = 'countdown';
    else if (hasCarousel && !productsCount) detectedType = 'hero';
    else if (blocks.length > 1 || items.length > 1) detectedType = 'multicolumn';
  }

  // ── Text align ──
  let textAlign = 'center';
  if (h) {
    const style = h.getAttribute('style') || '';
    if (style.includes('text-align: left') || style.includes('text-align:left')) textAlign = 'left';
    const cls = h.getAttribute('class') || '';
    if (cls.includes('text-left') || cls.includes('left')) textAlign = 'left';
  }

  return {
    detectedType,
    settings: {
      heading,
      subheading,
      columns,
      products_count: productsCount || columns,
      button_text: buttonText || '',
      image_ratio: imageRatio,
      text_align: textAlign,
      show_price: productsCount > 0,
      show_vendor: false,
      blocks,
    },
    meta: { productsCount, gridItems: items.length, blocksFound: blocks.length }
  };
}

function processRequest(reqId) {
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
  const { sectionType, themeSettings, targetPage, sourceFile, sectionHtml } = request;

  console.log(`Processing: ${reqId} (${sectionType} → ${targetPage})`);

  let html = '';
  if (sourceFile) {
    const filePath = path.join(EXTRACTED_DIR, sourceFile);
    if (fs.existsSync(filePath)) html = fs.readFileSync(filePath, 'utf-8');
  }
  if (!html && sectionHtml) html = sectionHtml;

  let analysis = { detectedType: sectionType || 'rich-text', settings: { blocks: [] }, meta: {} };
  if (html) {
    analysis = analyzeHtml(html, sectionType);
  }

  // Normalize type: underscores → hyphens to match SECTION_TEMPLATES keys
  const finalType = (analysis.detectedType || sectionType || 'rich-text').replace(/_/g, '-');

  const recommendedChanges = {};
  if (themeSettings) {
    for (const key of ['page_width', 'font_heading', 'font_body', 'button_radius', 'button_text_transform', 'card_radius', 'card_shadow_opacity']) {
      if (themeSettings[key] != null) recommendedChanges[key] = themeSettings[key];
    }
  }

  const result = {
    id: reqId,
    status: 'done',
    wireframeSection: {
      type: finalType,
      heading: analysis.settings?.heading || '',
      settings: {
        heading: analysis.settings?.heading || '',
        subheading: analysis.settings?.subheading || '',
        columns: analysis.settings?.columns || 4,
        products_count: analysis.settings?.products_count || 4,
        button_text: analysis.settings?.button_text || '',
        button_style: 'solid',
        image_ratio: analysis.settings?.image_ratio || '1:1',
        text_align: analysis.settings?.text_align || 'center',
        show_price: analysis.settings?.show_price !== false,
        show_vendor: false,
        blocks: analysis.settings?.blocks || [],
      },
    },
    recommendedThemeChanges: recommendedChanges,
    analysis: `${sectionType} → ${finalType}: ${analysis.settings?.columns} cols, ${analysis.meta?.blocksFound || 0} blocks extracted, ${analysis.meta?.productsCount || 0} products`,
  };

  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Done: ${reqId} → ${finalType} (${analysis.settings?.blocks?.length || 0} blocks)`);
}

// CLI mode
const args = process.argv.slice(2);
if (args[0] === 'all') {
  const files = fs.readdirSync(QUEUE_DIR).filter(f => f.match(/^req-\d+\.json$/) && !f.includes('-result'));
  for (const f of files) {
    const id = f.replace('.json', '');
    if (!fs.existsSync(path.join(QUEUE_DIR, `${id}-result.json`))) processRequest(id);
  }
} else if (args[0]) {
  processRequest(args[0]);
}

module.exports = { processRequest };

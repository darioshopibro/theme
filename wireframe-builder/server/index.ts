import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const EXTRACTED_DIR = path.join(process.cwd(), "extracted");
if (!fs.existsSync(EXTRACTED_DIR)) fs.mkdirSync(EXTRACTED_DIR);

// Serve extracted HTML files
app.use("/extracted", express.static(EXTRACTED_DIR));

// List all extracted sections
app.get("/api/sections", (_req, res) => {
  const files = fs.readdirSync(EXTRACTED_DIR).filter(f => f.endsWith(".html"));
  const sections = files.map(f => {
    const meta = f.replace(".html", "").split("__");
    return { file: f, theme: meta[0] || f, section: meta[1] || f, url: `/extracted/${f}` };
  });
  res.json(sections);
});

// Extract a section from a Shopify demo URL
app.post("/api/extract", async (req, res) => {
  const { demoUrl, sectionMatch } = req.body;
  if (!demoUrl) return res.status(400).json({ error: "demoUrl required" });

  console.log(`Extracting from ${demoUrl}, looking for: ${sectionMatch || "auto"}`);

  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(demoUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll down and back to trigger lazy-loaded content
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 500) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 200));
      }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 2000));

    const result = await page.evaluate((match: string) => {
      // Collect ALL CSS
      let allCSS = "";
      for (const style of document.querySelectorAll("style")) {
        allCSS += style.textContent + "\n";
      }
      for (const sheet of document.styleSheets) {
        try { for (const rule of sheet.cssRules) allCSS += rule.cssText + "\n"; } catch (e) {}
      }

      // External stylesheets
      const extCSS = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => (l as HTMLLinkElement).href);

      // Find all sections
      const allSections = [...document.querySelectorAll('[id^="shopify-section"]')].map(el => {
        const id = el.id;
        const typeMatch = id.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
        const type = typeMatch ? typeMatch[1] : id.replace("shopify-section-", "");
        return { id, type, height: el.getBoundingClientRect().height, visible: el.getBoundingClientRect().height > 0 };
      });

      // Find target section
      let target: Element | null = null;
      if (match) {
        const sections = document.querySelectorAll('[id^="shopify-section"]');
        for (const s of sections) {
          if (s.id.toLowerCase().includes(match.toLowerCase())) { target = s; break; }
        }
      }

      if (!target) return { error: "Section not found", allSections };

      // Extract blocks (direct children) before cloning
      const blocks: { tag: string; html: string; text: string; height: number }[] = [];
      for (const child of target.children) {
        blocks.push({
          tag: child.tagName.toLowerCase(),
          html: child.outerHTML,
          text: child.textContent?.trim().slice(0, 80) || "",
          height: Math.round(child.getBoundingClientRect().height),
        });
      }

      // Collect image dimensions BEFORE cloning (getBoundingClientRect works on live DOM)
      const origImgs = target.querySelectorAll("img");
      const imgSizes: { w: number; h: number }[] = [];
      for (const img of origImgs) {
        const rect = img.getBoundingClientRect();
        imgSizes.push({ w: Math.round(rect.width) || 200, h: Math.round(rect.height) || 200 });
      }

      // Collect bg image elements
      const bgEls: number[] = [];
      const origAll = target.querySelectorAll("*");
      for (let i = 0; i < origAll.length; i++) {
        const computed = window.getComputedStyle(origAll[i]);
        if (computed.backgroundImage && computed.backgroundImage !== "none" && computed.backgroundImage.includes("url(")) {
          bgEls.push(i);
        }
      }

      // Now clone and replace
      const clone = target.cloneNode(true) as HTMLElement;

      // Replace images with placeholder divs using saved dimensions
      const cloneImgs = clone.querySelectorAll("img");
      for (let i = 0; i < cloneImgs.length; i++) {
        const img = cloneImgs[i];
        const size = imgSizes[i] || { w: 200, h: 200 };
        const div = document.createElement("div");
        div.style.cssText = "width:" + size.w + "px;height:" + size.h + "px;background:#c7d2dc;border-radius:4px;display:block;";
        div.setAttribute("data-placeholder", img.getAttribute("alt") || "image");
        img.parentNode?.replaceChild(div, img);
      }

      // Replace background images
      const cloneAll = clone.querySelectorAll("*");
      for (const idx of bgEls) {
        if (cloneAll[idx]) {
          (cloneAll[idx] as HTMLElement).style.backgroundImage = "none";
          (cloneAll[idx] as HTMLElement).style.backgroundColor = "#c7d2dc";
        }
      }

      // Handle lazy-loaded images
      const lazys = clone.querySelectorAll("[data-src], [srcset], source, picture source");
      for (const el of lazys) {
        if (el.tagName === "SOURCE") { el.remove(); continue; }
        const div = document.createElement("div");
        div.style.cssText = "width:100%;height:200px;background:#c7d2dc;border-radius:4px;display:block;";
        el.parentNode?.replaceChild(div, el);
      }

      // Also get the section's actual width for proper scaling
      const sectionWidth = Math.round(target.getBoundingClientRect().width);

      // Also clean each block
      const cleanBlocks: { tag: string; html: string; text: string; height: number }[] = [];
      for (const child of clone.children) {
        cleanBlocks.push({
          tag: child.tagName.toLowerCase(),
          html: child.outerHTML,
          text: child.textContent?.trim().slice(0, 80) || "",
          height: blocks.find(b => b.tag === child.tagName.toLowerCase())?.height || 100,
        });
      }

      return {
        sectionId: target.id,
        sectionHTML: clone.outerHTML,
        sectionWidth,
        allCSS,
        extCSS,
        allSections,
        blocks: cleanBlocks,
      };
    }, sectionMatch || "");

    if (result.error) {
      return res.json({ error: result.error, allSections: result.allSections });
    }

    // Build self-contained HTML with edit support + image placeholders + disabled links
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${(result.extCSS || []).map((url: string) => `<link rel="stylesheet" href="${url}">`).join("\n")}
<style>
${result.allCSS}

/* Catch any remaining images not replaced in DOM */
img { display: block !important; background: #c7d2dc !important; min-height: 60px !important; }
video { background: #c7d2dc !important; }
[style*="background-image"] { background-image: none !important; background: #c7d2dc !important; }
[data-placeholder] { background: #c7d2dc !important; }

/* Disable all links and interactions */
a { pointer-events: none !important; cursor: default !important; }
button:not(.block-toolbar button) { pointer-events: none !important; }

/* EDIT MODE — target all meaningful elements */
.edit-mode .editable-block {
  outline: 2px dashed rgba(99,102,241,0.35) !important;
  cursor: pointer !important;
}
.edit-mode .editable-block:hover {
  outline: 2px solid #6366f1 !important;
  background-color: rgba(99,102,241,0.04) !important;
}
.edit-mode .block-selected {
  outline: 3px solid #6366f1 !important;
  background-color: rgba(99,102,241,0.06) !important;
}
.edit-mode .block-hidden {
  opacity: 0.1 !important;
  outline-style: dotted !important;
}
.block-toolbar {
  position: fixed !important;
  display: flex !important; gap: 4px !important; z-index: 99999 !important;
  background: #fff !important; padding: 4px !important; border-radius: 6px !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2) !important;
}
.block-toolbar button {
  padding: 5px 12px !important; border-radius: 4px !important; font-size: 11px !important;
  font-weight: 600 !important; cursor: pointer !important; border: none !important;
  font-family: -apple-system, sans-serif !important;
}
.block-toolbar .hide-btn { background: #f3f4f6 !important; color: #374151 !important; }
.block-toolbar .hide-btn:hover { background: #e5e7eb !important; }
.block-toolbar .delete-btn { background: #ef4444 !important; color: #fff !important; }
.block-toolbar .delete-btn:hover { background: #dc2626 !important; }
</style>
</head>
<body style="margin:0;padding:0;">
${result.sectionHTML}
<script>
var editing = false;
var currentToolbar = null;

window.addEventListener('message', function(e) {
  if (e.data === 'EDIT_ON') { editing = true; enableEdit(); }
  if (e.data === 'EDIT_OFF') { editing = false; disableEdit(); }
});

function reportHeight() {
  window.parent.postMessage({ type: 'IFRAME_HEIGHT', height: document.body.scrollHeight }, '*');
}
window.addEventListener('load', function() { setTimeout(reportHeight, 300); });

function findBlocks() {
  // Find all meaningful visual blocks — divs, sections, headers, etc with real content
  var all = document.querySelectorAll('div, section, header, footer, nav, aside, article, figure, ul, form');
  var blocks = [];
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var rect = el.getBoundingClientRect();
    // Only elements that are visible, have height, and are not too deeply nested
    if (rect.height > 30 && rect.width > 100 && !el.classList.contains('block-toolbar')) {
      // Check depth — max 4 levels deep from body
      var depth = 0; var p = el;
      while (p.parentElement && p.parentElement !== document.body) { depth++; p = p.parentElement; }
      if (depth <= 4) blocks.push(el);
    }
  }
  return blocks;
}

function enableEdit() {
  var blocks = findBlocks();
  blocks.forEach(function(el) { el.classList.add('editable-block'); });

  document.addEventListener('click', onClick, true);
  document.body.style.overflow = 'auto';
}

function disableEdit() {
  document.querySelectorAll('.editable-block').forEach(function(el) { el.classList.remove('editable-block'); });
  document.querySelectorAll('.block-selected').forEach(function(el) { el.classList.remove('block-selected'); });
  if (currentToolbar) { currentToolbar.remove(); currentToolbar = null; }
  document.removeEventListener('click', onClick, true);
}

function onClick(e) {
  if (!editing) return;
  var target = e.target;

  // If clicking toolbar button, let it handle
  if (target.closest('.block-toolbar')) return;

  e.preventDefault();
  e.stopPropagation();

  // Find nearest editable block
  var block = target.closest('.editable-block');
  if (!block) return;

  // Deselect previous
  document.querySelectorAll('.block-selected').forEach(function(el) { el.classList.remove('block-selected'); });
  if (currentToolbar) { currentToolbar.remove(); currentToolbar = null; }

  // Select this block
  block.classList.add('block-selected');

  // Show toolbar near cursor
  var toolbar = document.createElement('div');
  toolbar.className = 'block-toolbar';
  var rect = block.getBoundingClientRect();
  toolbar.style.top = (rect.top + window.scrollY + 4) + 'px';
  toolbar.style.right = '8px';

  var hideBtn = document.createElement('button');
  hideBtn.className = 'hide-btn';
  hideBtn.textContent = block.classList.contains('block-hidden') ? 'Show' : 'Hide';
  hideBtn.onclick = function(ev) {
    ev.stopPropagation();
    block.classList.toggle('block-hidden');
    hideBtn.textContent = block.classList.contains('block-hidden') ? 'Show' : 'Hide';
    reportHeight();
  };

  var deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = function(ev) {
    ev.stopPropagation();
    block.remove();
    toolbar.remove();
    currentToolbar = null;
    reportHeight();
  };

  toolbar.appendChild(hideBtn);
  toolbar.appendChild(deleteBtn);
  document.body.appendChild(toolbar);
  currentToolbar = toolbar;
}
</script>
</body>
</html>`;

    // Save to file
    const themeName = new URL(demoUrl).hostname.replace(".myshopify.com", "");
    const sectionType = (result.sectionId || "section").split("__").pop()?.replace(/_[A-Za-z0-9]+$/, "") || "section";
    const filename = `${themeName}__${sectionType}.html`;
    const filepath = path.join(EXTRACTED_DIR, filename);
    fs.writeFileSync(filepath, html, "utf-8");

    // Save blocks JSON
    const blocksFile = filename.replace(".html", ".blocks.json");
    const blocksPath = path.join(EXTRACTED_DIR, blocksFile);
    fs.writeFileSync(blocksPath, JSON.stringify(result.blocks || [], null, 2), "utf-8");

    console.log(`Saved: ${filename} (${html.length} bytes) + ${blocksFile} (${(result.blocks || []).length} blocks)`);

    res.json({
      success: true,
      file: filename,
      blocksFile,
      url: `/extracted/${filename}`,
      sectionId: result.sectionId,
      blocks: result.blocks,
      allSections: result.allSections,
    });

  } catch (err: any) {
    console.error("Extract error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// List all sections from a demo URL (for picker)
app.post("/api/list-sections", async (req, res) => {
  const { demoUrl } = req.body;
  if (!demoUrl) return res.status(400).json({ error: "demoUrl required" });

  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(demoUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    const sections = await page.evaluate(() => {
      return [...document.querySelectorAll('[id^="shopify-section"]')].map(el => {
        const id = el.id;
        const typeMatch = id.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
        const type = typeMatch ? typeMatch[1] : id.replace("shopify-section-", "");
        const heading = el.querySelector("h1,h2,h3");
        return {
          id,
          type,
          heading: heading?.textContent?.trim().slice(0, 50) || null,
          height: Math.round(el.getBoundingClientRect().height),
          visible: el.getBoundingClientRect().height > 0,
        };
      });
    });

    res.json({ sections: sections.filter(s => s.visible) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// Save edited blocks back to HTML
app.post("/api/save-blocks", async (req, res) => {
  const { file, blocks, allCSS, extCSS } = req.body;
  if (!file || !blocks) return res.status(400).json({ error: "file and blocks required" });

  try {
    const sectionHTML = blocks.map((b: any) => b.html).join("\n");
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${(extCSS || []).map((url: string) => `<link rel="stylesheet" href="${url}">`).join("\n")}
<style>
${allCSS || ""}
[style*="background-image"] { background-image: none !important; background-color: #e2e8f0 !important; }
</style>
</head>
<body style="margin:0;padding:0;overflow:hidden;">
<div>${sectionHTML}</div>
</body>
</html>`;

    const filepath = path.join(EXTRACTED_DIR, file);
    fs.writeFileSync(filepath, html, "utf-8");

    // Update blocks JSON
    const blocksFile = file.replace(".html", ".blocks.json");
    fs.writeFileSync(path.join(EXTRACTED_DIR, blocksFile), JSON.stringify(blocks, null, 2), "utf-8");

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import full page — inline all CSS, keep external JS links
app.post("/api/import-page", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  console.log(`Importing full page: ${url}`);
  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Scroll to trigger lazy content
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 3000));

    // Get rendered HTML + all inline CSS + external resource URLs
    const pageData = await page.evaluate(() => {
      // Inline all CSS
      let allCSS = "";
      for (const style of document.querySelectorAll("style")) {
        allCSS += style.textContent + "\n";
      }
      for (const sheet of document.styleSheets) {
        try { for (const rule of sheet.cssRules) allCSS += rule.cssText + "\n"; } catch (e) {}
      }

      // Get external CSS links (for fonts etc)
      const extCSS = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => (l as HTMLLinkElement).href);

      // Get external JS
      const extJS = [...document.querySelectorAll('script[src]')].map(s => (s as HTMLScriptElement).src);

      // Get inline scripts
      const inlineJS: string[] = [];
      for (const s of document.querySelectorAll('script:not([src])')) {
        if (s.textContent && s.textContent.length > 10) inlineJS.push(s.textContent);
      }

      // Get full body HTML (rendered DOM)
      const bodyHTML = document.body.innerHTML;

      // Get sections
      const sections = [...document.querySelectorAll('[id^="shopify-section"]')].map(el => {
        const id = el.id;
        const typeMatch = id.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
        const type = typeMatch ? typeMatch[1] : id.replace("shopify-section-", "");
        const heading = el.querySelector("h1,h2,h3");
        const rect = el.getBoundingClientRect();
        return {
          id, type,
          heading: heading?.textContent?.trim().slice(0, 50) || null,
          top: Math.round(rect.top + window.scrollY),
          height: Math.round(rect.height),
          visible: rect.height > 0,
        };
      }).filter(s => s.visible);

      return { allCSS, extCSS, extJS, inlineJS, bodyHTML, sections };
    });

    // Build self-contained HTML with all CSS inline + JS from original
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${url}">
${pageData.extCSS.map((u: string) => `<link rel="stylesheet" href="${u}">`).join("\n")}
<style>${pageData.allCSS}</style>
<style>
  .pick-overlay {
    position: absolute; left: 0; right: 0; z-index: 99990;
    cursor: pointer; transition: background 0.15s, outline 0.15s;
    outline: 2px solid transparent; outline-offset: -2px;
  }
  .pick-overlay:hover {
    background: rgba(99,102,241,0.08);
    outline: 3px solid #6366f1;
  }
  .pick-overlay.picked {
    background: rgba(34,197,94,0.08);
    outline: 3px solid #22c55e;
  }
  .pick-overlay .pick-label {
    position: absolute; top: 6px; left: 6px;
    background: #6366f1; color: #fff; padding: 3px 10px; border-radius: 4px;
    font: 600 11px -apple-system, sans-serif; opacity: 0; transition: opacity 0.15s;
    pointer-events: none; white-space: nowrap;
    box-shadow: 0 2px 8px rgba(99,102,241,0.3);
  }
  .pick-overlay:hover .pick-label { opacity: 1; }
  .pick-overlay.picked .pick-label { background: #22c55e; opacity: 1; }
  .pick-banner {
    position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
    background: #6366f1; color: #fff; padding: 6px 16px; border-radius: 8px;
    font: 600 12px -apple-system, sans-serif; z-index: 99999; pointer-events: none;
    box-shadow: 0 4px 12px rgba(99,102,241,0.3);
  }
</style>
</head>
<body style="margin:0;padding:0;">
${pageData.bodyHTML}
${pageData.extJS.map((u: string) => `<script src="${u}"><\/script>`).join("\n")}
${pageData.inlineJS.map((js: string) => `<script>${js}<\/script>`).join("\n")}
<script>
// Wait for JS to render everything, then add pick overlays
setTimeout(function() {
  // Disable all links and buttons
  var style = document.createElement('style');
  style.textContent = 'a, button, input, select, textarea { pointer-events: none !important; }' +
    '.pick-overlay, .pick-overlay * { pointer-events: auto !important; }';
  document.head.appendChild(style);

  // Add banner
  var banner = document.createElement('div');
  banner.className = 'pick-banner';
  banner.textContent = 'Click a section to extract';
  document.body.appendChild(banner);

  // Add overlay for each shopify section
  var sections = document.querySelectorAll('[id^="shopify-section"]');
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var rect = sec.getBoundingClientRect();
    if (rect.height < 10) continue;

    sec.style.position = 'relative';

    var overlay = document.createElement('div');
    overlay.className = 'pick-overlay';
    overlay.style.top = '0';
    overlay.style.height = rect.height + 'px';

    var id = sec.id;
    var typeMatch = id.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
    var type = typeMatch ? typeMatch[1] : id.replace('shopify-section-', '');

    var label = document.createElement('div');
    label.className = 'pick-label';
    label.textContent = type + ' — click to extract';
    overlay.appendChild(label);

    overlay.setAttribute('data-section-id', id);
    overlay.setAttribute('data-section-type', type);
    overlay.setAttribute('data-section-height', Math.round(rect.height).toString());

    overlay.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.add('picked');
      window.parent.postMessage({
        type: 'SECTION_PICKED',
        sectionId: this.getAttribute('data-section-id'),
        sectionType: this.getAttribute('data-section-type'),
        height: parseInt(this.getAttribute('data-section-height') || '500')
      }, '*');
    });

    sec.appendChild(overlay);
  }

  // Report height
  window.parent.postMessage({ type: 'IFRAME_HEIGHT', height: document.body.scrollHeight }, '*');
}, 3000);
<\/script>
</body>
</html>`;

    const hostname = new URL(url).hostname.replace(".myshopify.com", "");
    const pageName = url.includes("/collections") ? "collection" : url.includes("/products") ? "product" : "homepage";
    const filename = `${hostname}__${pageName}_full.html`;
    const filepath = path.join(EXTRACTED_DIR, filename);
    fs.writeFileSync(filepath, html, "utf-8");

    console.log(`Saved: ${filename} (${html.length} bytes, ${pageData.sections.length} sections)`);
    res.json({ success: true, file: filename, url: `/extracted/${filename}`, sections: pageData.sections, size: html.length });

  } catch (err: any) {
    console.error("Import error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// Extract a section from an already-imported full page HTML file
app.post("/api/extract-from-file", async (req, res) => {
  const { file, sectionId } = req.body;
  if (!file || !sectionId) return res.status(400).json({ error: "file and sectionId required" });

  try {
    const filepath = path.join(EXTRACTED_DIR, file);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "file not found" });

    const fullHTML = fs.readFileSync(filepath, "utf-8");

    // Parse out the section by ID using regex (faster than full DOM parse)
    // Find the section element with this ID
    const idEscaped = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionMatch = fullHTML.match(new RegExp(`(<[^>]+id="${idEscaped}"[^>]*>[\\s\\S]*?)(?=<[^/][^>]+id="shopify-section|$)`, 'i'));

    if (!sectionMatch) {
      return res.json({ error: "Section not found in file", sectionId });
    }

    let sectionHTML = sectionMatch[1];

    // Clean up — close any unclosed tags (rough but works for extraction)
    // Count open vs close tags for the root element
    const rootTag = sectionHTML.match(/<(\w+)/)?.[1] || 'div';
    const openCount = (sectionHTML.match(new RegExp(`<${rootTag}[\\s>]`, 'gi')) || []).length;
    const closeCount = (sectionHTML.match(new RegExp(`</${rootTag}>`, 'gi')) || []).length;
    for (let i = closeCount; i < openCount; i++) {
      sectionHTML += `</${rootTag}>`;
    }

    // Extract CSS from the full page (everything in <style> tags and inline styles)
    const styles: string[] = [];
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = styleRegex.exec(fullHTML)) !== null) {
      styles.push(styleMatch[1]);
    }

    // Extract external CSS links
    const cssLinks: string[] = [];
    const linkRegex = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(fullHTML)) !== null) {
      cssLinks.push(linkMatch[1]);
    }

    // Extract base tag if present
    const baseMatch = fullHTML.match(/<base[^>]+href="([^"]+)"/i);
    const baseHref = baseMatch ? baseMatch[1] : "";

    // Build self-contained section HTML
    const sectionFile = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${baseHref ? `<base href="${baseHref}">` : ''}
${cssLinks.map(u => `<link rel="stylesheet" href="${u}">`).join("\n")}
<style>
${styles.join("\n")}
a { pointer-events: none !important; cursor: default !important; }
img { background: #c7d2dc !important; }
[style*="background-image"] { background-image: none !important; background: #c7d2dc !important; }
</style>
</head>
<body style="margin:0;padding:0;">
${sectionHTML}
<script>
function reportHeight() {
  window.parent.postMessage({ type: 'IFRAME_HEIGHT', height: document.body.scrollHeight }, '*');
}
window.addEventListener('load', function() { setTimeout(reportHeight, 500); });
</script>
</body>
</html>`;

    // Save as separate file
    const themeName = file.replace(/__.*/, '');
    const sectionType = sectionId.split('__').pop()?.replace(/_[A-Za-z0-9]+$/, '') || 'section';
    const outFilename = `${themeName}__${sectionType}_extracted.html`;
    fs.writeFileSync(path.join(EXTRACTED_DIR, outFilename), sectionFile, "utf-8");

    console.log(`Extracted section ${sectionType} from ${file} → ${outFilename} (${sectionFile.length} bytes)`);

    res.json({ success: true, file: outFilename, sectionId, sectionType });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Extract a single section from an already-saved full page HTML
app.post("/api/extract-from-file", (req, res) => {
  const { file, sectionId } = req.body;
  if (!file || !sectionId) return res.status(400).json({ error: "file and sectionId required" });

  try {
    const filepath = path.join(EXTRACTED_DIR, file);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "file not found" });

    const fullHTML = fs.readFileSync(filepath, "utf-8");

    // Extract <head> content (styles, links)
    const headMatch = fullHTML.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : "";

    // Find the section by ID — grab from opening tag to next shopify-section or end
    const idEscaped = sectionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Strategy: find the section element, then grab until next sibling section
    const sectionRegex = new RegExp(
      `(<[^>]+id="${idEscaped}"[\\s\\S]*?)(<[^/][^>]+id="shopify-section-)`,
      "i"
    );
    let sectionHTML = "";
    const match = fullHTML.match(sectionRegex);
    if (match) {
      sectionHTML = match[1];
    } else {
      // Maybe last section — grab from ID to </body>
      const lastMatch = fullHTML.match(new RegExp(`(<[^>]+id="${idEscaped}"[\\s\\S]*?)(<\\/body>|<script>\\s*\\/\\/ Wait)`, "i"));
      if (lastMatch) sectionHTML = lastMatch[1];
    }

    if (!sectionHTML) return res.json({ error: "Section not found in file" });

    // Build self-contained section HTML
    const outHTML = `<!DOCTYPE html>
<html>
<head>
${headContent}
<style>
a { pointer-events: none !important; cursor: default !important; }
button:not(.block-toolbar button) { pointer-events: none !important; }
img { background: #c7d2dc !important; }
</style>
</head>
<body style="margin:0;padding:0;overflow:hidden;">
${sectionHTML}
<script>
window.addEventListener('load', function() {
  setTimeout(function() {
    window.parent.postMessage({ type: 'IFRAME_HEIGHT', height: document.body.scrollHeight }, '*');
  }, 500);
});
<\/script>
</body>
</html>`;

    // Save
    const themeName = file.replace(/__.*/, "");
    const typeMatch = sectionId.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
    const sectionType = typeMatch ? typeMatch[1] : "section";
    const outFilename = `${themeName}__${sectionType}_picked.html`;
    fs.writeFileSync(path.join(EXTRACTED_DIR, outFilename), outHTML, "utf-8");

    console.log(`Extracted ${sectionType} from ${file} → ${outFilename} (${outHTML.length} bytes)`);
    res.json({ success: true, file: outFilename, sectionType });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Screenshot a page with section bounding boxes overlay
app.post("/api/screenshot", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // Get section positions
    const sections = await page.evaluate(() => {
      // Try Shopify sections first, then generic
      let els = [...document.querySelectorAll('[id^="shopify-section"]')];
      if (els.length === 0) {
        els = [...document.querySelectorAll('section, header, footer, [class*="section"], main > div')];
      }
      return els.map(el => {
        const rect = el.getBoundingClientRect();
        const id = el.id || el.className?.toString().slice(0, 50) || el.tagName;
        const typeMatch = id.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
        const type = typeMatch ? typeMatch[1] : id.replace("shopify-section-", "").slice(0, 40);
        const heading = el.querySelector("h1,h2,h3");
        return {
          id,
          type,
          heading: heading?.textContent?.trim().slice(0, 50) || null,
          top: Math.round(rect.top + window.scrollY),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.height > 0,
        };
      }).filter(s => s.visible && s.height > 10);
    });

    // Take full page screenshot
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1440, height: pageHeight });
    const screenshot = await page.screenshot({ fullPage: true, type: "png", encoding: "base64" });

    res.json({
      screenshot: `data:image/png;base64,${screenshot}`,
      sections,
      pageWidth: 1440,
      pageHeight,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = 3007;
app.listen(PORT, () => console.log(`Section extractor server on http://localhost:${PORT}`));

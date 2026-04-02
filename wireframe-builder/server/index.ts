import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import * as shopify from "./shopify.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const EXTRACTED_DIR = path.join(process.cwd(), "extracted");
if (!fs.existsSync(EXTRACTED_DIR)) fs.mkdirSync(EXTRACTED_DIR);

const QUEUE_DIR = path.join(process.cwd(), "queue");
if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR);

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

      // Get sections — Shopify or generic
      let sectionEls = [...document.querySelectorAll('[id^="shopify-section"]')];
      if (sectionEls.length === 0) {
        sectionEls = [...document.querySelectorAll('body > section, body > header, body > footer, body > nav, body > main, body > div > section, body > div > header, body > div > footer, main > section, main > div')];
      }
      const sections = sectionEls.map((el, idx) => {
        const id = el.id || el.className?.toString().split(' ')[0] || el.tagName.toLowerCase() + '-' + idx;
        const typeMatch = id.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
        const type = typeMatch ? typeMatch[1] : id.replace("shopify-section-", "").slice(0, 30);
        const heading = el.querySelector("h1,h2,h3");
        const rect = el.getBoundingClientRect();
        return {
          id, type,
          heading: heading?.textContent?.trim().slice(0, 50) || null,
          top: Math.round(rect.top + window.scrollY),
          height: Math.round(rect.height),
          visible: rect.height > 0 && rect.height > 30,
        };
      }).filter(s => s.visible);

      return { allCSS, extCSS, extJS, inlineJS, bodyHTML, sections };
    });

    // Extract settings in a separate evaluate to avoid tsx __name issue
    const recommended = await page.evaluate(`
      (function() {
        var root = document.documentElement;
        var cs = getComputedStyle(root);
        var cssVars = {};
        for (var i = 0; i < cs.length; i++) {
          var prop = cs[i];
          if (prop.startsWith("--")) {
            var val = cs.getPropertyValue(prop).trim();
            if (val) cssVars[prop] = val;
          }
        }
        var rgbToHex = function(rgb) {
          var match = rgb.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
          if (!match) return null;
          return "#" + [match[1], match[2], match[3]].map(function(n) { return parseInt(n).toString(16).padStart(2, "0"); }).join("");
        };
        var tripletToHex = function(t) {
          var p = t.split(",").map(function(s) { return parseInt(s.trim()); });
          if (p.length !== 3 || p.some(isNaN)) return null;
          return "#" + p.map(function(n) { return n.toString(16).padStart(2, "0"); }).join("");
        };
        var bodyS = getComputedStyle(document.body);
        var btnEl = document.querySelector('button, .btn, [class*="button"]');
        var btnS = btnEl ? getComputedStyle(btnEl) : null;
        var cardS = null; try { var cardEl = document.querySelector('[class*="card"]'); cardS = cardEl ? getComputedStyle(cardEl) : null; } catch(e) {}
        var r = {};
        r.color_background = rgbToHex(bodyS.backgroundColor) || "#ffffff";
        r.color_foreground = rgbToHex(bodyS.color) || "#121212";
        if (cssVars["--color-primary"]) r.color_primary = tripletToHex(cssVars["--color-primary"]);
        if (!r.color_primary && btnS) r.color_primary = rgbToHex(btnS.backgroundColor);
        if (cssVars["--color-secondary"]) r.color_secondary = tripletToHex(cssVars["--color-secondary"]);
        r.font_heading = (cssVars["--font-heading-family"] || "").split(",")[0].replace(/['"]/g, "").trim() || "Playfair Display";
        r.font_body = (cssVars["--font-body-family"] || "").split(",")[0].replace(/['"]/g, "").trim() || "Inter";
        if (cssVars["--page-width"]) r.page_width = parseInt(cssVars["--page-width"]);
        if (btnS) { r.button_radius = parseInt(btnS.borderRadius) || 0; r.button_text_transform = btnS.textTransform || "none"; }
        if (cardS) { r.card_radius = parseInt(cardS.borderRadius) || 0; }
        return r;
      })()
    `);

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

  // Add overlay for each section — Shopify first, then generic fallback
  var sections = document.querySelectorAll('[id^="shopify-section"]');
  if (sections.length === 0) {
    // Non-Shopify: use semantic elements
    sections = document.querySelectorAll('body > section, body > header, body > footer, body > nav, body > main, body > div > section, body > div > header, body > div > footer, main > section, main > div');
  }
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var rect = sec.getBoundingClientRect();
    if (rect.height < 30 || rect.width < 200) continue;

    sec.style.position = 'relative';

    var overlay = document.createElement('div');
    overlay.className = 'pick-overlay';
    overlay.style.top = '0';
    overlay.style.height = rect.height + 'px';

    var id = sec.id || sec.className.toString().split(' ')[0] || sec.tagName.toLowerCase() + '-' + i;
    var typeMatch = id.match(/__(.+?)(?:_[A-Za-z0-9]+)?$/);
    var type = typeMatch ? typeMatch[1] : id.replace('shopify-section-', '').slice(0, 30);

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

    console.log(`Saved: ${filename} (${html.length} bytes, ${pageData.sections.length} sections, ${Object.keys(recommended || {}).length} settings)`);
    res.json({ success: true, file: filename, url: `/extracted/${filename}`, sections: pageData.sections, recommended, size: html.length });

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

// Extract theme settings from a live URL
app.post("/api/extract-settings", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const settings = await page.evaluate(() => {
      const root = document.documentElement;
      const computed = getComputedStyle(root);

      // Extract ALL CSS custom properties
      var cssVars = {};
      for (var prop of computed) {
        if (prop.startsWith("--")) {
          var val = computed.getPropertyValue(prop).trim();
          if (val) cssVars[prop] = val;
        }
      }

      var rgbToHex = function(rgb) {
        var match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return null;
        return "#" + [match[1], match[2], match[3]].map(function(n) { return parseInt(n).toString(16).padStart(2, "0"); }).join("");
      }

      var tripletToHex = function(triplet) {
        var parts = triplet.split(",").map(function(s) { return parseInt(s.trim()); });
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        return "#" + parts.map(function(n) { return n.toString(16).padStart(2, "0"); }).join("");
      }

      var bodyS = getComputedStyle(document.body);
      var h1El = document.querySelector("h1");
      var h1S = h1El ? getComputedStyle(h1El) : null;
      var btnEl = document.querySelector('button, .btn, a.button, [class*="button"]');
      var btnS = btnEl ? getComputedStyle(btnEl) : null;
      var cardEl = document.querySelector('[class*="card"], [class*="product-card"]');
      var cardS = cardEl ? getComputedStyle(cardEl) : null;
      var inputEl = document.querySelector('input[type="text"], input[type="email"]');
      var inputS = inputEl ? getComputedStyle(inputEl) : null;

      var recommended = {};

      // Colors
      recommended.color_background = rgbToHex(bodyS.backgroundColor) || "#ffffff";
      recommended.color_foreground = rgbToHex(bodyS.color) || "#121212";
      if (cssVars["--color-primary"]) recommended.color_primary = tripletToHex(cssVars["--color-primary"]);
      if (cssVars["--color-secondary"]) recommended.color_secondary = tripletToHex(cssVars["--color-secondary"]);
      if (cssVars["--color-accent"]) recommended.color_accent = tripletToHex(cssVars["--color-accent"]);
      // Fallback from button bg
      if (!recommended.color_primary && btnS) recommended.color_primary = rgbToHex(btnS.backgroundColor);

      // Typography
      recommended.font_heading = cssVars["--font-heading-family"]?.split(",")[0].replace(/['"]/g, "").trim() || h1S?.fontFamily?.split(",")[0].replace(/['"]/g, "").trim();
      recommended.font_body = cssVars["--font-body-family"]?.split(",")[0].replace(/['"]/g, "").trim() || bodyS.fontFamily.split(",")[0].replace(/['"]/g, "").trim();

      // Layout
      const pageWidth = cssVars["--page-width"];
      if (pageWidth) recommended.page_width = parseInt(pageWidth);

      // Buttons
      if (btnS) {
        recommended.button_radius = parseInt(btnS.borderRadius) || 0;
        recommended.button_border_width = parseInt(btnS.borderWidth) || 0;
        recommended.button_text_transform = btnS.textTransform || "none";
      }

      // Cards
      if (cardS) {
        recommended.card_radius = parseInt(cardS.borderRadius) || 0;
        recommended.card_border_width = parseInt(cardS.borderWidth) || 0;
        const shadow = cardS.boxShadow;
        recommended.card_shadow_opacity = (shadow && shadow !== "none") ? 30 : 0;
      }

      // Inputs
      if (inputS) {
        recommended.input_radius = parseInt(inputS.borderRadius) || 0;
        recommended.input_border_width = parseInt(inputS.borderWidth) || 0;
      }

      // Spacing
      if (cssVars["--spacing-sections-desktop"]) {
        recommended.section_spacing = Math.round(parseInt(cssVars["--spacing-sections-desktop"]) / 10);
      }

      return { cssVars, recommended };
    });

    console.log(`Extracted settings from ${url}: ${Object.keys(settings.recommended).length} recommended values`);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// Queue a section for AI analysis (Claude Code hook picks this up)
app.post("/api/queue-section", (req, res) => {
  const { sectionHtml, sectionType, themeSettings, targetPage, sourceUrl, sourceFile } = req.body;
  if (!sectionHtml) return res.status(400).json({ error: "sectionHtml required" });

  const id = `req-${Date.now()}`;
  const request = {
    id,
    status: "pending",
    createdAt: new Date().toISOString(),
    sectionType: sectionType || "unknown",
    targetPage: targetPage || "homepage",
    sourceUrl: sourceUrl || "",
    sourceFile: sourceFile || "",
    themeSettings,
    sectionHtml: sectionHtml.slice(0, 50000), // limit size
  };

  fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(request, null, 2), "utf-8");
  console.log(`Queued section: ${id} (${sectionType}, ${targetPage})`);
  res.json({ id, status: "pending" });
  // No auto-process — Claude (via /analyze-section skill) handles this
});

// Check queue result
app.get("/api/queue/:id", (req, res) => {
  const resultPath = path.join(QUEUE_DIR, `${req.params.id}-result.json`);
  const requestPath = path.join(QUEUE_DIR, `${req.params.id}.json`);

  if (fs.existsSync(resultPath)) {
    const result = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
    return res.json({ status: "done", result });
  }
  if (fs.existsSync(requestPath)) {
    const request = JSON.parse(fs.readFileSync(requestPath, "utf-8"));
    return res.json({ status: request.status || "pending" });
  }
  res.json({ status: "not_found" });
});

// List all queue items
app.get("/api/queue", (_req, res) => {
  const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith(".json") && !f.includes("-result"));
  const items = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), "utf-8"));
    const hasResult = fs.existsSync(path.join(QUEUE_DIR, f.replace(".json", "-result.json")));
    return { id: data.id, type: data.sectionType, page: data.targetPage, status: hasResult ? "done" : "pending", createdAt: data.createdAt };
  });
  res.json(items);
});

// Analyze an imported section and generate wireframe settings
app.post("/api/analyze-section", async (req, res) => {
  const { file, sectionId } = req.body;
  if (!file) return res.status(400).json({ error: "file required" });

  try {
    const filepath = path.join(EXTRACTED_DIR, file);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "file not found" });

    // Use Puppeteer to analyze the rendered section
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 3000 });
    await page.goto(`http://localhost:${PORT}/extracted/${file}`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const analysis = await page.evaluate(`
      (function() {
        var body = document.body;
        var all = body.querySelectorAll('*');

        // Count product cards
        var productCards = body.querySelectorAll('[class*="product-card"], [class*="product_card"], [class*="ProductCard"], .card, [class*="grid-item"]');
        var productsCount = productCards.length;

        // Detect grid columns
        var gridEl = body.querySelector('[class*="grid"], [class*="collection"], [style*="grid"]');
        var columns = 4;
        if (gridEl) {
          var gridStyle = getComputedStyle(gridEl);
          var gtc = gridStyle.gridTemplateColumns;
          if (gtc && gtc !== 'none') {
            columns = gtc.split(' ').filter(function(s) { return s && s !== '0px'; }).length;
          }
        }
        if (productsCount > 0 && columns === 4) {
          // Estimate from product count per row
          var firstRow = [];
          var firstY = null;
          for (var i = 0; i < productCards.length; i++) {
            var rect = productCards[i].getBoundingClientRect();
            if (firstY === null) firstY = rect.top;
            if (Math.abs(rect.top - firstY) < 20) firstRow.push(productCards[i]);
            else break;
          }
          if (firstRow.length > 0) columns = firstRow.length;
        }

        // Find headings
        var h1 = body.querySelector('h1, h2, h3');
        var heading = h1 ? h1.textContent.trim().slice(0, 60) : '';

        // Find subheading
        var sub = h1 ? h1.nextElementSibling : null;
        var subheading = '';
        if (sub && (sub.tagName === 'P' || sub.tagName === 'SPAN' || sub.tagName === 'DIV')) {
          subheading = sub.textContent.trim().slice(0, 80);
        }

        // Find buttons
        var btn = body.querySelector('button, a.btn, [class*="button"], a[class*="btn"]');
        var buttonText = btn ? btn.textContent.trim().slice(0, 30) : '';

        // Detect section type from content
        var sectionType = 'rich-text';
        var hasProducts = productsCount > 0;
        var hasTestimonials = body.textContent.includes('review') || body.textContent.includes('testimonial') || body.querySelectorAll('[class*="testimonial"], [class*="review"]').length > 0;
        var hasNewsletter = body.querySelectorAll('input[type="email"], [class*="newsletter"]').length > 0;
        var hasVideo = body.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0;
        var hasBlog = body.querySelectorAll('[class*="blog"], [class*="article"], article').length > 0;
        var hasLogos = body.querySelectorAll('[class*="logo-list"], [class*="partners"], [class*="brand"]').length > 3;
        var hasTrustBadges = body.querySelectorAll('[class*="trust"], [class*="badge"], [class*="guarantee"]').length > 2;
        var isHero = body.querySelector('[class*="hero"], [class*="banner"], [class*="slideshow"], [class*="carousel"]') !== null;
        var hasMediaText = body.querySelectorAll('[class*="media-with-text"], [class*="image-with-text"]').length > 0;

        if (isHero) sectionType = 'hero';
        else if (hasProducts && productsCount > 2) sectionType = 'featured-collection';
        else if (hasTestimonials) sectionType = 'testimonials';
        else if (hasNewsletter) sectionType = 'newsletter';
        else if (hasVideo) sectionType = 'video';
        else if (hasBlog) sectionType = 'featured-blog';
        else if (hasLogos) sectionType = 'logo-list';
        else if (hasTrustBadges) sectionType = 'trust-badges';
        else if (hasMediaText) sectionType = 'media-with-text';
        else if (columns > 1) sectionType = 'multicolumn';

        // Image ratio detection
        var firstImg = productCards[0] ? productCards[0].querySelector('img, [class*="image"]') : null;
        var imageRatio = '1:1';
        if (firstImg) {
          var imgRect = firstImg.getBoundingClientRect();
          if (imgRect.width > 0 && imgRect.height > 0) {
            var ratio = imgRect.width / imgRect.height;
            if (ratio > 1.2) imageRatio = '16:9';
            else if (ratio > 0.9) imageRatio = '1:1';
            else if (ratio > 0.7) imageRatio = '3:4';
            else imageRatio = '3:4';
          }
        }

        // Text alignment
        var textAlign = 'center';
        if (h1) {
          var h1Style = getComputedStyle(h1);
          textAlign = h1Style.textAlign || 'center';
        }

        // Height
        var height = Math.round(body.scrollHeight);

        return {
          detectedType: sectionType,
          settings: {
            heading: heading,
            subheading: subheading,
            columns: columns,
            products_count: productsCount || columns,
            button_text: buttonText,
            image_ratio: imageRatio,
            text_align: textAlign,
            show_price: hasProducts,
            show_vendor: false,
          },
          meta: {
            hasProducts: hasProducts,
            productsCount: productsCount,
            hasTestimonials: hasTestimonials,
            hasNewsletter: hasNewsletter,
            hasVideo: hasVideo,
            hasBlog: hasBlog,
            isHero: isHero,
            height: height,
          }
        };
      })()
    `);

    await browser.close();

    console.log(`Analyzed ${file}: type=${analysis.detectedType}, cols=${analysis.settings.columns}, products=${analysis.settings.products_count}`);
    res.json(analysis);
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

// ── Persist app state to disk instead of localStorage ──
const STATE_FILE = path.join(process.cwd(), "app-state.json");

app.get("/api/state", (_req, res) => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      res.json(data);
    } else {
      res.json(null);
    }
  } catch (e) {
    res.json(null);
  }
});

app.post("/api/state", (req, res) => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Write queue result (used by Claude /analyze-section skill) ──
app.post("/api/queue/:id/result", (req, res) => {
  const resultPath = path.join(QUEUE_DIR, `${req.params.id}-result.json`);
  fs.writeFileSync(resultPath, JSON.stringify(req.body, null, 2), "utf-8");
  console.log(`Result written for ${req.params.id}`);
  res.json({ ok: true });
});

// ── AI group suggestion (heuristic fallback, no API key needed) ──
app.post("/api/suggest-group", (req, res) => {
  const { sectionType, existingGroups } = req.body;
  const type = (sectionType || "").toLowerCase();

  // Smart mapping of section types to group names
  const typeToGroup: Record<string, string> = {
    "hero": "Hero & Banners",
    "banner": "Hero & Banners",
    "slideshow": "Hero & Banners",
    "carousel": "Hero & Banners",
    "featured-collection": "Product Sections",
    "featured-products-grid": "Product Sections",
    "collection-tabs": "Product Sections",
    "main-collection": "Product Sections",
    "related-products": "Product Sections",
    "recently-viewed": "Product Sections",
    "shop-the-look": "Product Sections",
    "testimonials": "Social Proof",
    "reviews": "Social Proof",
    "press": "Social Proof",
    "logo-list": "Social Proof",
    "newsletter": "Lead Capture & CTA",
    "countdown": "Lead Capture & CTA",
    "media-with-text": "Content Sections",
    "multicolumn": "Content Sections",
    "rich-text": "Content Sections",
    "image-gallery": "Content Sections",
    "video": "Content Sections",
    "featured-blog": "Content Sections",
    "trust-badges": "Utility",
    "announcement-bar": "Utility",
    "header": "Utility",
    "footer": "Utility",
    "breadcrumb": "Utility",
    "collection-icons": "Navigation",
    "collection-banner": "Navigation",
  };

  const suggestedName = typeToGroup[type] || "Uncategorized";

  // Check if an existing group matches
  const groups = existingGroups || [];
  const match = groups.find((g: any) =>
    g.name.toLowerCase() === suggestedName.toLowerCase() ||
    g.name.toLowerCase().includes(suggestedName.split(" ")[0].toLowerCase())
  );

  res.json({
    groupId: match?.id || null,
    groupName: suggestedName,
    confidence: match ? 0.9 : 0.7,
  });
});

// ══════════════════════════════════════════════════════════
// ── Shopify Store Integration ──
// ══════════════════════════════════════════════════════════

// Check connection status
app.get("/api/shopify/status", async (_req, res) => {
  try {
    const config = shopify.getConfig();
    if (!config) return res.json({ connected: false });

    const shop = await shopify.getShopInfo();
    const theme = await shopify.getActiveTheme();
    res.json({
      connected: true,
      storeUrl: config.storeUrl,
      shopName: shop.name,
      themeName: theme?.name || "Unknown",
      themeId: theme?.id || null,
    });
  } catch (e: any) {
    res.json({ connected: false, error: e.message });
  }
});

// Connect to store (validate + save credentials)
app.post("/api/shopify/connect", async (req, res) => {
  const { storeUrl, accessToken } = req.body;
  if (!storeUrl || !accessToken) {
    return res.status(400).json({ error: "storeUrl and accessToken required" });
  }

  // Normalize store URL
  const normalized = storeUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // Save temporarily to test
  shopify.saveConfig(normalized, accessToken);

  try {
    const shop = await shopify.getShopInfo();
    const theme = await shopify.getActiveTheme();
    console.log(`Connected to Shopify store: ${shop.name}`);
    res.json({
      connected: true,
      storeUrl: normalized,
      shopName: shop.name,
      themeName: theme?.name || "Unknown",
      themeId: theme?.id || null,
    });
  } catch (e: any) {
    // Remove bad creds
    fs.writeFileSync(path.join(process.cwd(), ".env"), "", "utf-8");
    res.status(400).json({ error: `Connection failed: ${e.message}` });
  }
});

// Disconnect
app.post("/api/shopify/disconnect", (_req, res) => {
  const envFile = path.join(process.cwd(), ".env");
  if (fs.existsSync(envFile)) fs.writeFileSync(envFile, "", "utf-8");
  res.json({ ok: true });
});

// List themes
app.get("/api/shopify/themes", async (_req, res) => {
  try {
    const themes = await shopify.getThemes();
    res.json(themes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get template JSON for a page (index, collection, product)
app.get("/api/shopify/theme/:id/template/:page", async (req, res) => {
  try {
    const themeId = Number(req.params.id);
    const page = req.params.page; // "index", "collection", "product"
    const template = await shopify.getTemplateJson(themeId, page);
    res.json(template);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// List all section files in a theme
app.get("/api/shopify/theme/:id/sections", async (req, res) => {
  try {
    const sections = await shopify.listSections(Number(req.params.id));
    res.json(sections);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Read any theme asset
app.get("/api/shopify/theme/:id/asset", async (req, res) => {
  try {
    const key = req.query.key as string;
    if (!key) return res.status(400).json({ error: "key query param required" });
    const asset = await shopify.getThemeAsset(Number(req.params.id), key);
    res.json(asset);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// ── CMS: Push changes to Shopify ──
// ══════════════════════════════════════════════════════════

// Push theme settings
app.post("/api/shopify/push-settings", async (req, res) => {
  try {
    const { themeId, settings } = req.body;
    if (!themeId || !settings) return res.status(400).json({ error: "themeId and settings required" });

    // Map our settings format to Shopify's settings_data.json format
    const shopifySettings: Record<string, any> = {};

    // Color scheme mapping — update scheme-1 (primary scheme)
    if (settings.color_background || settings.color_foreground || settings.color_primary ||
        settings.color_secondary || settings.color_accent) {
      // Read current to get color_schemes structure
      const asset = await shopify.getThemeAsset(themeId, "config/settings_data.json");
      const data = JSON.parse(asset.value);
      const schemes = data.current?.color_schemes || {};
      const scheme1 = schemes["scheme-1"]?.settings || {};

      if (settings.color_background) scheme1.background = settings.color_background;
      if (settings.color_foreground) {
        scheme1.foreground = settings.color_foreground;
        scheme1.foreground_heading = settings.color_foreground;
      }
      if (settings.color_primary) {
        scheme1.primary = settings.color_primary;
        scheme1.primary_button_background = settings.color_primary;
        scheme1.primary_button_border = settings.color_primary;
      }

      shopifySettings.color_schemes = {
        ...schemes,
        "scheme-1": { settings: scheme1 },
      };
    }

    // Layout
    if (settings.page_width) {
      // Map pixel value to Shopify's width options
      const pw = settings.page_width;
      shopifySettings.page_width = pw <= 1200 ? "narrow" : pw <= 1400 ? "default" : "wide";
    }

    // Buttons
    if (settings.button_radius !== undefined) shopifySettings.button_border_radius_primary = settings.button_radius;
    if (settings.button_border_width !== undefined) shopifySettings.primary_button_border_width = settings.button_border_width;

    // Inputs
    if (settings.input_radius !== undefined) shopifySettings.inputs_border_radius = settings.input_radius;
    if (settings.input_border_width !== undefined) shopifySettings.input_border_width = settings.input_border_width;

    // Cards
    if (settings.card_radius !== undefined) shopifySettings.card_corner_radius = settings.card_radius;
    if (settings.badge_radius !== undefined) shopifySettings.badge_corner_radius = settings.badge_radius;

    await shopify.pushSettings(themeId, shopifySettings);

    // Invalidate ALL preview caches
    for (const key of Object.keys(PREVIEW_CACHE)) delete PREVIEW_CACHE[key];

    console.log("Settings pushed to Shopify");
    res.json({ ok: true, invalidated: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Push section order
app.post("/api/shopify/push-section-order", async (req, res) => {
  try {
    const { themeId, page, order } = req.body;
    const templateName = page === "homepage" ? "index" : page;
    await shopify.pushSectionOrder(themeId, templateName, order);

    // Invalidate preview cache for this page
    delete PREVIEW_CACHE[page];

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Add section to page
app.post("/api/shopify/add-section", async (req, res) => {
  try {
    const { themeId, page, sectionKey, sectionType, settings: sectionSettings, position } = req.body;
    const templateName = page === "homepage" ? "index" : page;
    await shopify.addSectionToTemplate(themeId, templateName, sectionKey, sectionType, sectionSettings, position);

    // Invalidate preview cache for this page
    delete PREVIEW_CACHE[page];

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Remove section from page
app.post("/api/shopify/remove-section", async (req, res) => {
  try {
    const { themeId, page, sectionKey } = req.body;
    const templateName = page === "homepage" ? "index" : page;
    await shopify.removeSectionFromTemplate(themeId, templateName, sectionKey);

    // Invalidate preview cache for this page
    delete PREVIEW_CACHE[page];

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update section settings
app.post("/api/shopify/update-section", async (req, res) => {
  try {
    const { themeId, page, sectionKey, settings: sectionSettings } = req.body;
    const templateName = page === "homepage" ? "index" : page;
    await shopify.updateSectionSettings(themeId, templateName, sectionKey, sectionSettings);

    delete PREVIEW_CACHE[page];

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Invalidate preview cache (called after any push)
app.post("/api/shopify/invalidate-preview", (req, res) => {
  const { pages } = req.body;
  if (pages && Array.isArray(pages)) {
    for (const page of pages) delete PREVIEW_CACHE[page];
  } else {
    // Invalidate all
    for (const key of Object.keys(PREVIEW_CACHE)) delete PREVIEW_CACHE[key];
  }
  res.json({ ok: true, timestamp: Date.now() });
});

// Sync settings FROM Shopify theme → our format
app.get("/api/shopify/sync-settings/:themeId", async (req, res) => {
  try {
    const themeId = Number(req.params.themeId);
    const asset = await shopify.getThemeAsset(themeId, "config/settings_data.json");
    const data = JSON.parse(asset.value);
    const current = data.current || {};

    // Extract color scheme 1
    const scheme1 = current.color_schemes?.["scheme-1"]?.settings || {};

    // Map Shopify settings to our format
    const mapped: Record<string, any> = {
      // Colors from scheme-1
      color_background: scheme1.background || "#ffffff",
      color_foreground: scheme1.foreground_heading || scheme1.foreground || "#000000",
      color_primary: scheme1.primary_button_background || scheme1.primary || "#000000",
      color_secondary: scheme1.secondary_button_background || "#334fb4",
      color_accent: scheme1.primary_hover || "#ff6b35",

      // Fonts
      font_heading: mapShopifyFont(current.type_heading_font),
      font_body: mapShopifyFont(current.type_body_font),

      // Layout
      page_width: current.page_width === "wide" ? 1600 : current.page_width === "narrow" ? 1200 : 1400,
      section_spacing: 40,

      // Buttons
      button_radius: current.button_border_radius_primary ?? 0,
      button_border_width: current.primary_button_border_width ?? 1,

      // Inputs
      input_radius: current.inputs_border_radius ?? 0,
      input_border_width: current.input_border_width ?? 1,

      // Cards
      card_radius: current.card_corner_radius ?? 0,
      badge_radius: current.badge_corner_radius ?? 40,
    };

    res.json(mapped);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Map Shopify font identifier to Google Font name
function mapShopifyFont(shopifyFont: string | undefined): string {
  if (!shopifyFont) return "Inter";
  // Shopify format: "inter_n4", "playfair_display_n7", etc.
  const name = shopifyFont
    .replace(/_n\d$/, "")  // remove weight suffix
    .replace(/_i\d$/, "")  // remove italic suffix
    .split("_")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return name || "Inter";
}

// Section Rendering API proxy
app.get("/api/shopify/render-section", async (req, res) => {
  try {
    const { page, section_id } = req.query;
    if (!section_id) return res.status(400).json({ error: "section_id required" });

    const pagePath = (page as string) || "/";
    const html = await shopify.storefrontFetch(pagePath, {
      section_id: section_id as string,
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Live Preview via Puppeteer Proxy ──

const PREVIEW_CACHE: Record<string, { html: string; timestamp: number }> = {};
const PREVIEW_TTL = 30000; // 30s cache

app.get("/api/shopify/preview/:page", async (req, res) => {
  const page = req.params.page as string; // homepage, collection, product
  const forceRefresh = req.query.refresh === "1";

  try {
    const config = shopify.getConfig();
    if (!config) return res.status(400).send("Shopify not connected");

    // Check cache
    const cached = PREVIEW_CACHE[page];
    if (!forceRefresh && cached && Date.now() - cached.timestamp < PREVIEW_TTL) {
      res.setHeader("Content-Type", "text/html");
      return res.send(cached.html);
    }

    // Determine URL to fetch
    let targetPath = "/";
    if (page === "collection") {
      try {
        const collections = await shopify.getCollections(1);
        if (collections.length > 0) targetPath = `/collections/${collections[0].handle}`;
        else targetPath = "/collections/all";
      } catch { targetPath = "/collections/all"; }
    } else if (page === "product") {
      try {
        const products = await shopify.getProducts(1);
        if (products.length > 0) targetPath = `/products/${products[0].handle}`;
        else targetPath = "/products";
      } catch { targetPath = "/products"; }
    }

    const storeUrl = `https://${config.storeUrl}${targetPath}`;
    console.log(`Live preview: fetching ${storeUrl}`);

    const browser = await puppeteer.launch({ headless: "new" as any, args: ["--no-sandbox"] });
    const browserPage = await browser.newPage();
    await browserPage.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
    await browserPage.setViewport({ width: 1440, height: 900 });

    // First, navigate to store — check if password-protected
    await browserPage.goto(`https://${config.storeUrl}/`, { waitUntil: "networkidle2", timeout: 60000 });

    // Handle password page: check for password form
    const hasPasswordPage = await browserPage.evaluate(() => {
      return !!document.querySelector('form[action="/password"]') ||
             !!document.querySelector('input[name="password"]') ||
             document.title.toLowerCase().includes('password');
    });

    if (hasPasswordPage) {
      // Read storefront password from .env
      const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
      const pwMatch = env.match(/^SHOPIFY_STOREFRONT_PASSWORD=(.+)$/m);
      const storefrontPw = pwMatch?.[1]?.trim();

      if (storefrontPw) {
        console.log("Password page detected, entering storefront password...");
        // Type password and submit
        await browserPage.type('input[name="password"]', storefrontPw);
        await browserPage.click('button[type="submit"], input[type="submit"]');
        await browserPage.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
      } else {
        await browser.close();
        return res.status(400).send(`<html><body style="font-family:sans-serif;padding:40px;color:#666;text-align:center">
          <h2>Store is password-protected</h2>
          <p>Add your storefront password to <code>.env</code>:</p>
          <pre style="background:#f3f4f6;padding:12px;border-radius:8px;display:inline-block">SHOPIFY_STOREFRONT_PASSWORD=your_password</pre>
          <p style="margin-top:16px;font-size:12px;color:#9ca3af">This is the visitor password, not your admin password</p>
        </body></html>`);
      }
    }

    // Now navigate to the actual target page (if not already there)
    if (targetPath !== "/") {
      await browserPage.goto(`https://${config.storeUrl}${targetPath}`, { waitUntil: "networkidle2", timeout: 60000 });
    }

    // Scroll to trigger lazy content
    await browserPage.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 500) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 1500));

    // Get the full page HTML
    let html = await browserPage.content();
    await browser.close();

    // Inject <base> tag for absolute URLs
    const baseTag = `<base href="https://${config.storeUrl}/">`;
    const injectCSS = `<style>
      /* Highlight Shopify sections on hover */
      [id^="shopify-section"]:hover { outline: 2px dashed rgba(99,102,241,0.5); outline-offset: -2px; }
      /* Remove any fixed/sticky positioning that breaks iframe */
      .shopify-section-header, header { position: relative !important; }
      /* No internal scroll */
      html, body { overflow: hidden !important; }
    </style>`;
    // Inject script that reports page height to parent (with page identifier)
    const pageId = page === 'homepage' ? 'homepage' : page;
    const injectScript = `<script>
      (function() {
        var pageId = '${pageId}';
        function reportHeight() {
          var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
          window.parent.postMessage({ type: 'iframeHeight', page: pageId, height: h }, '*');
        }
        window.addEventListener('load', function() { setTimeout(reportHeight, 500); setTimeout(reportHeight, 2000); setTimeout(reportHeight, 5000); });
        new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true });
        setTimeout(reportHeight, 100);
      })();
    </script>`;
    html = html.replace("<head>", `<head>${baseTag}${injectCSS}`);
    html = html.replace("</body>", `${injectScript}</body>`);

    // Strip CSP meta tags that block framing
    html = html.replace(/<meta[^>]*content-security-policy[^>]*>/gi, "");
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "");

    // Cache it
    PREVIEW_CACHE[page] = { html, timestamp: Date.now() };

    // Save to disk too (for debugging)
    const previewFile = path.join(EXTRACTED_DIR, `live-preview-${page}.html`);
    fs.writeFileSync(previewFile, html, "utf-8");

    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.send(html);
  } catch (e: any) {
    console.error(`Preview failed for ${page}:`, e.message);
    res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px;color:#666">
      <h2>Preview failed</h2><p>${e.message}</p>
      <button onclick="location.reload()">Retry</button>
    </body></html>`);
  }
});

// Get section list from the live theme's template JSON (for overlay labels)
app.get("/api/shopify/theme/:id/page-sections/:page", async (req, res) => {
  try {
    const themeId = Number(req.params.id);
    const pageName = req.params.page === "homepage" ? "index" : req.params.page;
    const template = await shopify.getTemplateJson(themeId, pageName);

    const sections = [];
    const order = template.order || [];
    for (const key of order) {
      const sec = template.sections?.[key];
      if (sec) {
        sections.push({
          key,
          type: sec.type,
          settings: sec.settings || {},
        });
      }
    }
    res.json({ sections });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sync theme sections to wireframe format ──
// Returns all 3 pages' sections mapped to our wireframe ThemeSection type

// Map Shopify section types to our wireframe types
const SHOPIFY_TYPE_MAP: Record<string, string> = {
  // Layout
  "announcement-bar": "announcement-bar",
  "header": "header",
  "footer": "footer",
  // Hero
  "image-banner": "hero",
  "slideshow": "hero",
  "hero": "hero",
  "hero-banner": "hero",
  // Products
  "featured-collection": "featured-collection",
  "product-list": "featured-collection",
  "featured-product": "featured-collection",
  "product-recommendations": "related-products",
  "recently-viewed-products": "recently-viewed",
  // Product page
  "main-product": "product-main",
  "product-information": "product-main",
  // Collection page
  "main-collection-product-grid": "main-collection",
  "main-collection": "main-collection",
  "collection-banner": "collection-banner",
  "collection-list": "collection-icons",
  "section": "main-collection",
  // Content
  "rich-text": "rich-text",
  "image-with-text": "media-with-text",
  "multicolumn": "multicolumn",
  "multirow": "multicolumn",
  "collage": "image-gallery",
  "video": "video",
  "featured-blog": "featured-blog",
  // Social proof
  "testimonials": "testimonials",
  "logo-list": "logo-list",
  // Lead capture
  "newsletter": "newsletter",
  "contact-form": "newsletter",
  "email-signup-banner": "newsletter",
  // Navigation
  "breadcrumbs": "breadcrumb",
  "breadcrumb": "breadcrumb",
};

// Default heights per section type
const SECTION_HEIGHTS: Record<string, number> = {
  "announcement-bar": 40, "header": 80, "hero": 500, "footer": 300,
  "featured-collection": 400, "rich-text": 200, "newsletter": 250,
  "media-with-text": 350, "multicolumn": 300, "video": 400,
  "image-gallery": 400, "collection-icons": 250, "featured-blog": 350,
  "product-main": 600, "main-collection": 800, "collection-banner": 250,
  "breadcrumb": 40, "related-products": 350, "testimonials": 300,
};

app.get("/api/shopify/sync-wireframe/:themeId", async (req, res) => {
  try {
    const themeId = Number(req.params.themeId);
    const pages: Record<string, string> = {
      homepage: "index",
      collection: "collection",
      product: "product",
    };

    const result: Record<string, any[]> = {};

    for (const [pageType, templateName] of Object.entries(pages)) {
      try {
        const template = await shopify.getTemplateJson(themeId, templateName);
        const order = template.order || [];
        const sections: any[] = [];

        // Always add header at top (Shopify renders it from layout, not template)
        sections.push({
          id: `theme-${pageType}-header`,
          type: "header",
          heading: null,
          visible: true,
          order: 0,
          height: 80,
          settings: { heading: "", subheading: "", columns: 4, text_align: "center", full_width: true, button_text: "", button_style: "solid", image_ratio: "1:1", content_position: "center", products_count: 4, show_price: true, show_vendor: false },
          shopifyKey: "header",
          shopifyType: "header",
        });

        for (let i = 0; i < order.length; i++) {
          const key = order[i];
          const sec = template.sections?.[key];
          if (!sec) continue;

          const shopifyType = sec.type || key;
          const wireframeType = SHOPIFY_TYPE_MAP[shopifyType] || "rich-text";

          // Extract heading from settings or blocks
          let heading = sec.settings?.title || sec.settings?.heading || sec.settings?.text || null;
          // Check blocks for heading text
          if (!heading && sec.blocks) {
            for (const block of Object.values(sec.blocks) as any[]) {
              if (block.type === "text" || block.type === "heading") {
                const text = block.settings?.text || "";
                // Strip HTML tags
                const clean = text.replace(/<[^>]*>/g, "").trim();
                if (clean) { heading = clean; break; }
              }
            }
          }
          // Extract button text from blocks
          let buttonText = sec.settings?.button_label || sec.settings?.button_text || "Shop Now";
          if (sec.blocks) {
            for (const block of Object.values(sec.blocks) as any[]) {
              if (block.type === "button" && block.settings?.label) {
                buttonText = block.settings.label;
                break;
              }
            }
          }

          sections.push({
            id: `theme-${pageType}-${key}`,
            type: wireframeType,
            heading: heading,
            visible: true,
            order: i,
            height: SECTION_HEIGHTS[wireframeType] || 300,
            settings: {
              heading: heading || "",
              subheading: sec.settings?.subheading || sec.settings?.subtitle || "",
              columns: sec.settings?.columns_desktop || sec.settings?.columns || 4,
              text_align: sec.settings?.text_alignment || "center",
              full_width: sec.settings?.full_width || false,
              button_text: buttonText,
              button_style: "solid",
              image_ratio: "1:1",
              content_position: sec.settings?.desktop_content_position || "center",
              products_count: sec.settings?.products_to_show || 4,
              show_price: true,
              show_vendor: false,
            },
            shopifyKey: key,
            shopifyType: shopifyType,
          });
        }

        // Always add footer at bottom
        sections.push({
          id: `theme-${pageType}-footer`,
          type: "footer",
          heading: null,
          visible: true,
          order: sections.length,
          height: 300,
          settings: { heading: "", subheading: "", columns: 4, text_align: "center", full_width: true, button_text: "", button_style: "solid", image_ratio: "1:1", content_position: "center", products_count: 4, show_price: true, show_vendor: false },
          shopifyKey: "footer",
          shopifyType: "footer",
        });

        result[pageType] = sections;
      } catch (e: any) {
        console.log(`Could not read template ${templateName}: ${e.message}`);
        result[pageType] = [];
      }
    }

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3007;
app.listen(PORT, () => console.log(`Section extractor server on http://localhost:${PORT}`));

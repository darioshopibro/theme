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

      // Replace images with placeholder divs
      const clone = target.cloneNode(true) as HTMLElement;
      const imgs = clone.querySelectorAll("img");
      for (const img of imgs) {
        const div = document.createElement("div");
        const rect = img.getBoundingClientRect();
        div.style.cssText = `width:${rect.width || 200}px;height:${rect.height || 200}px;background:linear-gradient(135deg,#e2e8f0,#cbd5e1);border-radius:4px;display:inline-block;`;
        div.setAttribute("data-placeholder", img.getAttribute("alt") || "image");
        img.parentNode?.replaceChild(div, img);
      }

      // Replace background images with solid colors
      const allEls = clone.querySelectorAll("*");
      for (const el of allEls) {
        const computed = window.getComputedStyle(el);
        const bgImage = computed.backgroundImage;
        if (bgImage && bgImage !== "none" && bgImage.includes("url(")) {
          (el as HTMLElement).style.backgroundImage = "none";
          (el as HTMLElement).style.backgroundColor = "#e2e8f0";
        }
      }

      // Also handle lazy-loaded images (data-src, srcset)
      const lazys = clone.querySelectorAll("[data-src], [srcset], source");
      for (const el of lazys) {
        if (el.tagName === "SOURCE") { el.remove(); continue; }
        const div = document.createElement("div");
        div.style.cssText = "width:100%;height:200px;background:linear-gradient(135deg,#e2e8f0,#cbd5e1);border-radius:4px;";
        el.parentNode?.replaceChild(div, el);
      }

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
        allCSS,
        extCSS,
        allSections,
        blocks: cleanBlocks,
      };
    }, sectionMatch || "");

    if (result.error) {
      return res.json({ error: result.error, allSections: result.allSections });
    }

    // Build self-contained HTML
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${(result.extCSS || []).map((url: string) => `<link rel="stylesheet" href="${url}">`).join("\n")}
<style>
${result.allCSS}
/* Override any remaining background images */
[style*="background-image"] { background-image: none !important; background-color: #e2e8f0 !important; }
</style>
</head>
<body style="margin:0;padding:0;overflow:hidden;">
${result.sectionHTML}
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

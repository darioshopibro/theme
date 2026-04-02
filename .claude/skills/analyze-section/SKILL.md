---
name: analyze-section
description: Analyze an imported section from wireframe builder queue and generate wireframe settings
argument-hint: [request-id or "all" for all pending]
---

# Analyze Section — Build Wireframe

Process queued sections in `wireframe-builder/queue/`.

## Steps

1. Find pending requests in `wireframe-builder/queue/` — `req-*.json` without matching `req-*-result.json`
   - If `$ARGUMENTS` is a specific ID, process only that one
   - If "all" or empty, process all pending

2. For each pending request:

   a. Read request JSON (`sectionType`, `sourceFile`, `themeSettings`)
   
   b. **Take a screenshot** of the section to visually understand layout:
      - Read the extracted HTML file as an image/screenshot, or use the server:
      - `curl http://localhost:3007/extracted/{sourceFile}` to view it
      - Use the Read tool on the HTML file to see the rendered content
   
   c. **Read the source HTML** from `wireframe-builder/extracted/{sourceFile}` — read the FULL file
   
   d. **Check section-rules.md** in this skill directory for type-specific analysis rules
   
   e. Analyze thoroughly:
      - What TYPE of section is this? (check CSS classes for clues)
      - Is it a carousel/slider? Count ALL slides
      - Layout: grid, flex, split, stacked, full-width?
      - All text content: headings, descriptions, prices, buttons
      - Number of items/columns/slides EXACTLY

3. Build result with blocks array using REAL extracted content

4. Write result to `wireframe-builder/queue/req-{id}-result.json`:
```json
{
  "id": "req-{id}",
  "status": "done",
  "wireframeSection": {
    "type": "section-type",
    "heading": "Real Heading",
    "settings": {
      "heading": "Real Heading",
      "subheading": "Real sub",
      "columns": 4,
      "products_count": 4,
      "button_text": "Shop All",
      "text_align": "center",
      "image_ratio": "1:1",
      "show_price": true,
      "show_vendor": false,
      "blocks": [
        { "heading": "Real Name", "description": "Real desc", "button_text": "CTA", "has_image": true }
      ]
    }
  },
  "analysis": "Brief description of section and what was found"
}
```

5. POST result: `curl -X POST http://localhost:3007/api/queue/req-{id}/result -H 'Content-Type: application/json' -d @wireframe-builder/queue/req-{id}-result.json`

6. DELETE the request file after processing

## IMPORTANT — Read section-rules.md
Before writing ANY result, read `section-rules.md` in this skill directory. It has specific rules for carousel detection, product card extraction, price formats, etc.

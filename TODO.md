# TODO

## 1. Theme research (CURRENT)
- [x] Basic scraper (name, price, reviews, niche) — 60 themes
- [x] Dedup + detailed logs
- [x] Launch date — reviews/month works
- [x] Reviews/month calculation
- [x] Feature extraction (tested on Krank — 58 features, working)
- [x] Review sentiment pos/neg/neutral (tested, works from SVG icons)
- [x] Developer/studio + preset count (tested, working)
- [ ] **FULL RUN** with features + sentiment + demo sections — running in background
- [ ] Review texts — full pull from `/reviews` subpages, but only for themes in the chosen niche (after the niche decision)

## 2. Niche research (after themes)
- [ ] Filter the JSON by niche (the scraper already pulls every theme — no separate scrape needed)
- [ ] Rank niches by reviews/month
- [ ] Find pairs of similar niches (SEO keyword overlap, sections port across)
- [ ] Section map: which sections appear in 80%+ of top themes (must-have)
- [ ] Feature frequency map: must-have vs differentiator
- [ ] **DECISION: 2 niches** (one per dev)

## 3. Engine variables
- [ ] Lock the variable LIST (~60: layout / spacing / typography / colors / shape / buttons / animation / components)
- [ ] Variables MUST tie back to Shopify `settings_schema.json` — merchants need to customize from the editor with no code
- [ ] Define the boundary: which variables are dev-only (CSS) vs merchant-facing (schema setting) — finalize once niches are picked and a few variables are corrected
- [ ] Responsive variables — define how we handle per-breakpoint values (gutter 16px mobile, 32px desktop, etc.)
- [ ] Default values for each layout/preset (2–3 layouts per theme so merchants can use it across multiple niches)
- [ ] Values are filled in only AFTER the wireframe step (step 4)

## 4. Wireframe builder + design direction
- [x] Infinite canvas with pan/zoom
- [x] 3 page frames (HP, Collection, Product) on the canvas
- [x] Sidebar with theme settings (colors, typography, spacing, buttons, cards)
- [x] Section drag & drop reorder inside frames
- [x] Section import with screenshot browser
- [x] Import FULL PAGE (rendered DOM + CSS + JS)
- [x] Section picking from imported page → extract onto canvas
- [x] Add section to frame (→ HP / → Col / → PDP) and extract from frame (←)
- [x] Preview mode with a 300–2400px width slider
- [x] Resize handle on sections (drag bottom edge)
- [x] Edit blocks in imported sections (hide/delete elements)
- [x] Progress bar + per-page checklist
- [x] Auto-save state in localStorage
- [x] Section library bottom drawer with groups
- [ ] **Wire settings to a real Shopify `settings_schema.json`** — so the export is a valid Shopify config
- [ ] **AI-recommended settings** — for every imported section, Claude analyzes it and suggests engine settings (colors, fonts, spacing, radius) that match
- [ ] Decide how AI settings recommendations surface in the UI (popup? sidebar panel? auto-apply?)
- [ ] Desktop AND mobile preview per frame
- [ ] Export: variables as JSON → engine config + `settings_schema.json`
- [ ] Portability list: green / yellow / red (only after wireframe is in place)

## 5. Development planning
- [ ] List of EVERY section for both themes (from the wireframe)
- [ ] List of EVERY feature for both themes
- [ ] Who builds what — Claude advises the split
- [ ] Order: dev A starts from #1, dev B from the last item, build toward the middle

## 6. Claude Code setup
- [ ] Research agent / script for theme analysis
- [ ] Skills for design and development
- [ ] MD template for section documentation
- [ ] Workflow: section done → MD → port assessment for the other theme

## 7. Development
- [ ] Engine base (shared variables, grid, typography, base components)
- [ ] Shared sections (header, footer, newsletter, FAQ, rich text, image+text)
- [ ] Theme A niche sections
- [ ] Theme B niche sections
- [ ] Cross-port green and yellow sections

## 8. QA & Submit
- [ ] Performance, accessibility, mobile, browser testing
- [ ] Demo store with content
- [ ] Submit both themes

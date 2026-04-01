# TODO

## 1. Research TEME (CURRENT)
- [x] Basic scraper (ime, cijena, reviews, niša) — 60 tema
- [x] Dedup + detaljni logovi
- [x] Launch date — reviews/month radi
- [x] Reviews/month kalkulacija
- [x] Feature extraction (testirano na Krank — 58 features, radi)
- [x] Review sentiment pos/neg/neutral (testirano, radi iz SVG ikona)
- [x] Developer/studio + preset count (testirano, radi)
- [ ] **FULL RUN** sa features + sentiment + sekcije iz demo-a — radi u pozadini
- [ ] Review tekstovi — SVE sa /reviews podstranice, ALI samo za teme u izabranoj niši (posle odluke)

## 2. Research NIŠE (posle tema)
- [ ] Filtrirati JSON po nišama (scraper hvata sve teme, ne treba poseban scrape)
- [ ] Rankirati niše po reviews/month
- [ ] Naći parove SLIČNIH niša (SEO keyword overlap, sekcije se prenose)
- [ ] Mapa sekcija: koje su u 80%+ top tema (must-have)
- [ ] Feature frequency map: must-have vs differentiator
- [ ] **ODLUKA: 2 niše** (jedna po devu)

## 3. Engine varijable
- [ ] Zaključati LISTU varijabli (~60: layout/spacing/typo/colors/shape/buttons/animation/components)
- [ ] Varijable MORAJU biti povezane sa Shopify settings_schema.json — merchant mora moći da customizuje iz editora bez koda
- [ ] Definisati granicu: koje varijable su dev-only (CSS) a koje merchant-facing (schema setting) — radimo kad izaberemo niše i ispravimo neke varijable
- [ ] Responsive varijable — definisati kako rješavamo različite vrijednosti po breakpointu (gutter 16px mobile, 32px desktop itd)
- [ ] Default vrijednosti za svaki layout/preset (2-3 layouta po temi, da merchant može koristiti za više niša)
- [ ] Vrijednosti dolaze TEK iz wireframe-a (korak 4)

## 4. Wireframe builder + dizajn pravac
- [x] Infinite canvas sa pan/zoom
- [x] 3 page frame-a (HP, Collection, Product) na canvasu
- [x] Sidebar sa theme settings (colors, typo, spacing, buttons, cards)
- [x] Section drag & drop reorder u frame-ovima
- [x] Import sekcija sa screenshot browse
- [x] Import FULL PAGE (rendered DOM + CSS + JS)
- [x] Section picking iz importovanog page-a → extract na canvas
- [x] Add section to frame (→ HP / → Col / → PDP) i extract iz frame-a (←)
- [x] Preview mode sa width slider 300-2400px
- [x] Resize handle na sekcijama (drag donju ivicu)
- [x] Edit blocks u importovanim sekcijama (hide/delete elemente)
- [x] Progress bar + checklist per page
- [x] Auto-save state u localStorage
- [x] Section library bottom drawer sa grupama
- [ ] **Settings povezati sa pravim Shopify settings_schema.json** — da kad exportujemo, output bude validan Shopify config
- [ ] **AI recommended settings** — za svaku importovanu sekciju, Claude analizira i predlaže naše engine settings (boje, fontovi, spacing, radius) da matčuju tu sekciju
- [ ] Smisliti kako AI settings recommendations izgledaju u UI-ju (popup? sidebar panel? automatski apply?)
- [ ] Desktop I mobile preview per frame
- [ ] Export: varijable kao JSON → postaje engine config + settings_schema.json
- [ ] Portability lista: zeleno / žuto / crveno (tek kad vidimo wireframe)

## 5. Planiranje razvoja
- [ ] Lista SVIH sekcija za obje teme (iz wireframe-a)
- [ ] Lista SVIH features za obje teme
- [ ] Ko radi šta — Claude savjetuje raspored
- [ ] Redoslijed: dev A kreće od #1, dev B od posljednje, bilduju ka sredini

## 6. Claude Code setup
- [ ] Research agent/skripta za analizu tema
- [ ] Skillovi za dizajn i development
- [ ] MD template za dokumentaciju sekcija
- [ ] Workflow: sekcija gotova → MD → procjena porta u drugu temu

## 7. Development
- [ ] Engine base (shared varijable, grid, typography, base components)
- [ ] Shared sekcije (header, footer, newsletter, FAQ, rich text, image+text)
- [ ] Tema A niche sekcije
- [ ] Tema B niche sekcije
- [ ] Cross-port zelenih i žutih sekcija

## 8. QA & Submit
- [ ] Performance, accessibility, mobile, browser testing
- [ ] Demo store sa sadržajem
- [ ] Submit obje teme

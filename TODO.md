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
- [ ] Napraviti wireframe builder (React) — baza: YT automation visual-editor (`~/Desktop/YT automation/tools/visual-editor`)
- [ ] Uzima research JSON kao input — zna koje sekcije/features postoje za izabranu nišu
- [ ] Infinite canvas (već postoji u visual-editoru) sa sekcijama kao blokovima
- [ ] Sidebar sa SVIM engine varijablama kao kontrolama (slideri, color picker, itd)
- [ ] Live preview — pomjeraš varijablu, wireframe se mijenja
- [ ] HP / Collection / Product tabs
- [ ] **Desktop I mobile preview** — obavezno oba
- [ ] Drag/reorder sekcije, brisanje, dodavanje
- [ ] Export: varijable kao JSON → postaje engine config
- [ ] Dario ocjenjuje, tweakuje, odobri → finalne varijable za obje teme
- [ ] Portability lista: zeleno / žuto / crveno (tek kad vidimo wireframe znamo šta se može portovati)

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

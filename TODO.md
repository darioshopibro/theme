# TODO

## 1. Research — data collection
- [x] Basic scraper (ime, cijena, reviews, niša) — 60 tema
- [x] Dedup + detaljni logovi
- [ ] Dodati launch date u scraper — KRITIČNO za reviews/month
- [ ] Pokrenuti scraper do 150+ reviews sa datumima
- [ ] Izračunati reviews/month po temi (= brzina prodaje)
- [ ] Scraper za sekcije — izvući sve sekcije iz demo-a top tema
- [ ] Upgrade JSON sa sekcijama svake teme (za inspiraciju)
- [ ] Feature lista po temi (mega menu, quick view, swatches itd)

## 2. Research — analiza i odluke
- [ ] Rankirati niše po reviews/month (ne total reviews)
- [ ] Naći parove SLIČNIH niša (SEO keyword overlap, sekcije se prenose)
- [ ] ODLUKA: 2 niše (jedna po devu)
- [ ] Deep dive na izabrane niše — sve postojeće teme analizirane
- [ ] Mapa sekcija: koje su u 80%+ top tema (must-have)

## 3. Planiranje PRIJE kodiranja
- [ ] Lista SVIH sekcija za obje teme
- [ ] Lista SVIH features za obje teme
- [ ] Dizajn pravac za svaku temu
- [ ] Portability lista: zeleno (direktan port) / žuto (treba mod) / crveno (posebno)
- [ ] Ko radi šta — Claude savjetuje raspored
- [ ] Redoslijed: dev A kreće od #1, dev B od posljednje, bilduju ka sredini

## 4. Engine varijable (PRIJE BILO KAKVE SEKCIJE)
- [ ] Definisati sve shared varijable (max-width, spacing, grid, breakpoints)
- [ ] Identificirati koje varijable su MOŽDA drugačije po temi
- [ ] **QUIZ SESSION** — Claude me detaljno ispituje o svakoj varijabli
- [ ] Token override sistem po temi

## 5. Claude Code setup
- [ ] Research agent/skripta za analizu tema
- [ ] Skillovi za dizajn i development
- [ ] MD template za dokumentaciju sekcija
- [ ] Workflow: sekcija gotova → MD → procjena porta u drugu temu

## 6. Development
- [ ] Engine base (shared varijable, grid, typography, base components)
- [ ] Shared sekcije (header, footer, newsletter, FAQ, rich text, image+text)
- [ ] Tema A niche sekcije
- [ ] Tema B niche sekcije
- [ ] Cross-port zelenih i žutih sekcija

## 7. QA & Submit
- [ ] Performance, accessibility, mobile, browser testing
- [ ] Demo store sa sadržajem
- [ ] Submit obje teme

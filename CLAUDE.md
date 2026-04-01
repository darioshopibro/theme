# Shopify Theme Store — Plan

## Šta radimo
Pravimo Shopify teme za oficijelni Theme Store. 2 deva (ja i drugar). Više tema odjednom.

## Struktura: Shared Engine
- Jedna baza (engine) — zajedničke varijable, base sections, snippets
- Svaka tema je layer iznad engine-a sa svojom nišom i vizualom
- Kad dev završi sekciju → Claude ODMAH:
  1. Napravi verziju te sekcije za drugu temu (swap tokeni, prilagodi niši)
  2. Napravi MD sa razlikama (vidi format ispod)
- Claude savjetuje koje sekcije radi ko

### Sekcija MD format (automatski se pravi za svaku gotovu sekciju)
```
# [Ime sekcije]
- **Original tema:** A ili B
- **Šta radi:** (1 rečenica)
- **Port status:** zeleno / žuto / crveno
- **Isto u obe teme:** (šta se ne mijenja)
- **Različito:** (koji tokeni, blokovi, layout se mijenjaju)
- **Ako žuto/crveno:** šta konkretno treba promijeniti i zašto
```
Ovo se pokreće automatski kroz /port-section skill.

## Varijable — ENGINE (razgraničiti ODMAH prije kodiranja)
- max-width, spacing, grid, breakpoints — definišu se jednom u engine-u
- Razmisliti koji engine elementi će MOŽDA biti drugačiji između tema
- Preko tih varijabli se iste sekcije prilagođavaju za obje teme
- **OVO JE KLJUČAN TODO** — kad dođemo do ovog koraka, Claude me mora detaljno ispitati o svakoj varijabli

## Portabilnost sekcija
- Neke sekcije mogu iz moje teme za njegovu, neke ne mogu
- Plan mora imati listu: koje mogu, koje ne mogu, koje trebaju modifikaciju
- Non-portable lista ZAVISI OD NIŠE — ako izaberemo slične niše koje gađaju 2 SEO keyworda, ta lista se drastično smanjuje
- **Zato biramo niše koje su BLISKE** — više sekcija se prenosi, manje duplog posla

## Workflow kad krenemo da kodiramo
- Isplanirati SVE sekcije, dizajn i features za obje teme PRIJE početka
- Jedan dev kreće od prve stavke, drugi od posljednje — bildujemo ka sredini
- Svaka gotova sekcija se procijeni za transfer u drugu temu

## Research faza — šta nam treba
- Scrape sa DATUMIMA (launch date) — da znamo reviews/month, ne samo total
- Sekcije od top tema — scraper/skripta koja izvuče sve sekcije iz demo-a
- Upgrade JSON sa sekcijama svake teme (za inspiraciju i poređenje)
- Research agent ili dio koji researčuje teme, gleda zapise, analizira

## Claude Code setup
- Napraviti/instalirati skillove za dizajn i development
- Research agent koji može da researčuje teme i skriptu
- Claude savjetuje prioritet sekcija, portabilnost, workflow

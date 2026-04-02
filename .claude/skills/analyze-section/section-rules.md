# Section Analysis Rules

Referenca za analyze-section skill. Prije nego sto napravis result, provjeri ove ruleove.

## Pravila za detekciju tipa

### Carousel / Hero
- Ako ima vise slide-ova (slider, swiper, carousel klase) → tip je `hero` sa blocksima za svaki slide
- Svaki slide ima: heading, description, button_text, has_image: true
- NIKAD ne smanji carousel na 1 slide — svi slide-ovi moraju biti u blocks
- Provjeri: `[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="slideshow"]`
- Pogledaj koliko `li` elemenata ima u slider wrapperu

### Featured Collection
- Ako ima product kartice sa cijenama → `featured-collection`
- Ako prvi item NEMA sliku ali ima heading/opis/CTA → to je info card (dark card), stavi ga kao prvi block sa `has_image: false`
- Izvuci: brand, cijena (sale + original), badge (New!, Sale!, Low stock)
- Format opisa za produkte: "BRAND — $price" ili "BRAND — $sale $original — Badge"

### Collection Tabs
- Ako ima tab bar sa vise tabova → `collection-tabs`
- Heading treba biti tab labele spojene sa " | " — npr "Power Drills | Power Saws | Impact Wrenches"
- Blocks su producti unutar aktivnog taba

### Shop the Look
- Slika lijevo + lista produkata desno
- Svaki product block: heading=ime, description="variant — $sale $original"
- button_text na sekciji: "Add All to Cart"
- content_position: "left", columns: 2

### Multicolumn
- Grid sa kategorijama/kolonama — svaka ima sliku, naslov, opis, CTA
- has_image: true za svaku kolonu

### Countdown
- Timer sekcija — blocks su [Days, Hours, Minutes]
- heading: "59", description: "Days" itd

### Trust Badges
- Ikone sa kratkim tekstom (Free Shipping, Returns, etc)
- Svaki badge je block sa heading=tekst, has_image: true (za ikonu)

## Generalna pravila

1. **UVIJEK pogledaj cijeli HTML** — ne samo prvih 100 linija
2. **Broji elemente tacno** — koliko producta, koliko kolona, koliko slide-ova
3. **Izvuci SVE tekstove** — nikad placeholder text
4. **Provjeri klase** — klase govore o tipu sekcije vise od HTML strukture
5. **Pogledaj data atribute** — data-price, data-vendor, data-product itd
6. **Sale cijene** — trazi `<s>`, `<del>`, `[class*="compare"]`, `[class*="was"]`
7. **Badges** — trazi `[class*="badge"]`, `[class*="tag"]`, `[class*="label"]`
8. **Ako nisi siguran** — bolje stavi vise informacija nego manje

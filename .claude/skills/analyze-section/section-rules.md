# Section Analysis Rules

Reference for the `analyze-section` skill. Check these rules before producing a result.

## Type detection rules

### Carousel / Hero
- If there are multiple slides (slider, swiper, carousel classes) → type is `hero` with one block per slide
- Each slide has: heading, description, button_text, has_image: true
- NEVER reduce a carousel to one slide — every slide must be in `blocks`
- Check: `[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="slideshow"]`
- Count the `li` elements inside the slider wrapper

### Featured Collection
- If there are product cards with prices → `featured-collection`
- If the first item has NO image but has a heading/description/CTA → it's an info card (dark card); put it as the first block with `has_image: false`
- Extract: brand, price (sale + original), badge (New!, Sale!, Low stock)
- Description format for products: `"BRAND — $price"` or `"BRAND — $sale $original — Badge"`

### Collection Tabs
- If there is a tab bar with multiple tabs → `collection-tabs`
- The heading should be the tab labels joined with `" | "` — e.g. `"Power Drills | Power Saws | Impact Wrenches"`
- Blocks are the products inside the active tab

### Shop the Look
- Image on the left + product list on the right
- Each product block: heading = name, description = `"variant — $sale $original"`
- Section `button_text`: `"Add All to Cart"`
- `content_position`: `"left"`, `columns`: 2

### Multicolumn
- Grid with categories/columns — each has an image, title, description, CTA
- `has_image: true` for every column

### Countdown
- Timer section — blocks are `[Days, Hours, Minutes]`
- heading: `"59"`, description: `"Days"`, etc.

### Trust Badges
- Icons with short text (Free Shipping, Returns, etc.)
- Each badge is a block with heading = text, `has_image: true` (for the icon)

## General rules

1. **ALWAYS read the entire HTML** — not just the first 100 lines
2. **Count elements precisely** — how many products, how many columns, how many slides
3. **Extract EVERY text** — never placeholder text
4. **Check class names** — class names tell you more about section type than the HTML structure
5. **Inspect data attributes** — `data-price`, `data-vendor`, `data-product`, etc.
6. **Sale prices** — look for `<s>`, `<del>`, `[class*="compare"]`, `[class*="was"]`
7. **Badges** — look for `[class*="badge"]`, `[class*="tag"]`, `[class*="label"]`
8. **When unsure** — include more information rather than less

# Shopify Theme Settings System -- Comprehensive Research Report

> Note: Web fetch/search tools were unavailable. This report is based on
> detailed knowledge of Shopify's theme architecture, the Dawn reference theme
> source code, and Shopify developer documentation (up to early 2025).

---

## 1. settings_schema.json -- Structure & Setting Types

### File location

```
theme-root/
  config/
    settings_schema.json   <-- defines the Theme Settings UI
    settings_data.json     <-- stores merchant's chosen values
```

### Top-level structure

`settings_schema.json` is a **JSON array** of objects. Each object is either a
**theme info block** or a **settings group** (rendered as a collapsible section
in the Shopify theme editor).

```jsonc
[
  {
    "name": "theme_info",          // special -- always first
    "theme_name": "My Theme",
    "theme_version": "1.0.0",
    "theme_author": "Acme",
    "theme_documentation_url": "https://...",
    "theme_support_url": "https://..."
  },
  {
    "name": "Colors",              // section heading in the editor
    "settings": [ ... ]           // array of individual settings
  },
  {
    "name": "Typography",
    "settings": [ ... ]
  }
]
```

### Complete list of input setting types

Each setting in the `settings` array has a `type` field. Here is the
**complete list** of supported types:

#### Basic input types

| Type | Description | Key properties |
|------|-------------|----------------|
| `text` | Single-line text | `id`, `label`, `default`, `placeholder`, `info` |
| `textarea` | Multi-line text | same as text |
| `number` | Integer input | `id`, `label`, `default`, `placeholder`, `info` |
| `range` | Slider with min/max/step | `id`, `label`, `min`, `max`, `step`, `unit`, `default`, `info` |
| `checkbox` | Boolean toggle | `id`, `label`, `default` (true/false), `info` |
| `select` | Dropdown | `id`, `label`, `options` (array of {value, label}), `default`, `info` |
| `radio` | Radio buttons | same as select |

#### Specialized types

| Type | Description | Key properties |
|------|-------------|----------------|
| `color` | Color picker (hex) | `id`, `label`, `default` ("#rrggbb" or ""), `info` |
| `color_scheme` | Pick from defined color schemes | `id`, `label`, `default`, `info` |
| `color_scheme_group` | Define a group of color schemes | `id`, `label`, `definition` (array of roles), `role` |
| `font_picker` | Font family selector (Shopify-hosted fonts) | `id`, `label`, `default` ("assistant_n4" etc.), `info` |
| `image_picker` | Image upload/selection | `id`, `label`, `info` |
| `video` | Shopify-hosted video | `id`, `label`, `info` |
| `video_url` | YouTube/Vimeo URL | `id`, `label`, `accept` (["youtube","vimeo"]), `default`, `info` |
| `url` | URL picker (can link to page, product, etc.) | `id`, `label`, `default`, `info` |
| `richtext` | Rich text editor | `id`, `label`, `default`, `info` |
| `inline_richtext` | Inline rich text (no block elements) | `id`, `label`, `default`, `info` |
| `html` | Raw HTML | `id`, `label`, `default`, `info` |
| `liquid` | Raw Liquid code | `id`, `label`, `default`, `info` |
| `article` | Article picker | `id`, `label`, `info` |
| `blog` | Blog picker | `id`, `label`, `info` |
| `collection` | Collection picker | `id`, `label`, `info` |
| `collection_list` | Multiple collections | `id`, `label`, `limit`, `info` |
| `product` | Product picker | `id`, `label`, `info` |
| `product_list` | Multiple products | `id`, `label`, `limit`, `info` |
| `page` | Page picker | `id`, `label`, `info` |
| `link_list` | Navigation menu picker | `id`, `label`, `info` |
| `metaobject` | Metaobject picker | `id`, `label`, `type` (metaobject type), `info` |

#### Sidebar/display-only types (not inputs)

| Type | Description |
|------|-------------|
| `header` | Section heading within a group |
| `paragraph` | Informational text for merchants |

### Concrete example: a full settings group

```json
{
  "name": "Colors",
  "settings": [
    {
      "type": "header",
      "content": "Primary colors"
    },
    {
      "type": "color",
      "id": "color_primary",
      "label": "Primary",
      "default": "#121212",
      "info": "Used for headings and buttons"
    },
    {
      "type": "color",
      "id": "color_secondary",
      "label": "Secondary",
      "default": "#334FB4"
    },
    {
      "type": "color",
      "id": "color_background",
      "label": "Background",
      "default": "#FFFFFF"
    },
    {
      "type": "color",
      "id": "color_text",
      "label": "Body text",
      "default": "#121212"
    }
  ]
}
```

### Concrete example: range (spacing)

```json
{
  "type": "range",
  "id": "spacing_section_vertical",
  "min": 0,
  "max": 100,
  "step": 4,
  "unit": "px",
  "label": "Vertical section spacing",
  "default": 40
}
```

### Concrete example: font_picker

```json
{
  "type": "font_picker",
  "id": "type_header_font",
  "label": "Heading font",
  "default": "assistant_n4"
}
```

The `default` value uses Shopify's font naming convention:
`{family}_{style}` where style is `n4` (normal 400), `i4` (italic 400),
`n7` (normal 700), etc.

### Concrete example: select

```json
{
  "type": "select",
  "id": "button_style",
  "label": "Button style",
  "default": "solid",
  "options": [
    { "value": "solid", "label": "Solid" },
    { "value": "outline", "label": "Outline" },
    { "value": "link", "label": "Link" }
  ]
}
```

---

## 2. CSS Custom Properties -- How Dawn Connects Settings to CSS Variables

### The bridge: inline styles in `theme.liquid`

Dawn (and most themes) define CSS custom properties in an **inline `<style>`
tag** inside `layout/theme.liquid`. This is the critical bridge between the
Shopify settings system and CSS.

The pattern:

```liquid
{%- comment -%} layout/theme.liquid {%- endcomment -%}
<!doctype html>
<html>
<head>
  ...
  {% style %}
    :root {
      /* ---- Colors ---- */
      --color-foreground: {{ settings.color_text.red }}, {{ settings.color_text.green }}, {{ settings.color_text.blue }};
      --color-background: {{ settings.color_background.red }}, {{ settings.color_background.green }}, {{ settings.color_background.blue }};
      --color-primary: {{ settings.color_primary.red }}, {{ settings.color_primary.green }}, {{ settings.color_primary.blue }};
      --color-secondary: {{ settings.color_secondary.red }}, {{ settings.color_secondary.green }}, {{ settings.color_secondary.blue }};

      /* ---- Typography ---- */
      --font-heading-family: {{ settings.type_header_font.family }}, {{ settings.type_header_font.fallback_families }};
      --font-heading-style: {{ settings.type_header_font.style }};
      --font-heading-weight: {{ settings.type_header_font.weight }};
      --font-body-family: {{ settings.type_body_font.family }}, {{ settings.type_body_font.fallback_families }};
      --font-body-style: {{ settings.type_body_font.style }};
      --font-body-weight: {{ settings.type_body_font.weight }};

      /* ---- Font sizes (computed from a scale setting) ---- */
      --font-heading-scale: {{ settings.heading_scale | divided_by: 100.0 }};
      --font-body-scale: {{ settings.body_scale | divided_by: 100.0 }};

      /* ---- Spacing ---- */
      --page-width: {{ settings.page_width | append: 'px' }};
      --spacing-sections-desktop: {{ settings.spacing_sections | times: 10 | append: 'px' }};
      --spacing-sections-mobile: {{ settings.spacing_sections | times: 7.5 | append: 'px' }};

      /* ---- Shape / Buttons ---- */
      --buttons-radius: {{ settings.buttons_radius }}px;
      --buttons-border-width: {{ settings.buttons_border_width }}px;
      --buttons-border-opacity: {{ settings.buttons_border_opacity | divided_by: 100.0 }};
      --inputs-radius: {{ settings.inputs_radius }}px;
      --inputs-border-width: {{ settings.inputs_border_width }}px;
      --inputs-border-opacity: {{ settings.inputs_border_opacity | divided_by: 100.0 }};

      /* ---- Card ---- */
      --card-corner-radius: {{ settings.card_corner_radius | divided_by: 10.0 }}rem;
      --card-border-width: {{ settings.card_border_width | divided_by: 10.0 }}rem;
      --card-border-opacity: {{ settings.card_border_opacity | divided_by: 100.0 }};
      --card-shadow-opacity: {{ settings.card_shadow_opacity | divided_by: 100.0 }};
      --card-shadow-horizontal-offset: {{ settings.card_shadow_horizontal_offset | divided_by: 10.0 }}rem;
      --card-shadow-vertical-offset: {{ settings.card_shadow_vertical_offset | divided_by: 10.0 }}rem;
      --card-shadow-blur-radius: {{ settings.card_shadow_blur_radius | divided_by: 10.0 }}rem;

      /* ---- Badges ---- */
      --badge-corner-radius: {{ settings.badge_corner_radius | divided_by: 10.0 }}rem;

      /* ---- Other layout ---- */
      --grid-desktop-horizontal-spacing: 2rem;
      --grid-desktop-vertical-spacing: 2rem;
      --grid-mobile-horizontal-spacing: 1rem;
      --grid-mobile-vertical-spacing: 1rem;

      /* ---- Animation ---- */
      --duration-short: 100ms;
      --duration-default: 200ms;
      --duration-long: 500ms;
      --duration-extra-long: 600ms;
      --duration-announcement-bar: {{ settings.announcement_bar_speed }}s;
    }
  {% endstyle %}
  ...
</head>
```

### Key pattern: RGB triplet storage for colors

Dawn stores colors as **comma-separated RGB triplets** (not hex), enabling
alpha compositing in CSS:

```css
/* Variable stores: 18, 18, 18 */
--color-foreground: 18, 18, 18;

/* Usage with alpha: */
.overlay {
  background-color: rgba(var(--color-foreground), 0.7);
}
```

This is a deliberate design pattern. The `color` setting type in Shopify
returns an object with `.red`, `.green`, `.blue`, `.alpha`, `.hue`,
`.saturation`, `.lightness` properties.

### Key pattern: font object properties

The `font_picker` type returns a font object with these Liquid properties:

| Property | Example | Description |
|----------|---------|-------------|
| `.family` | `"Assistant"` | Font family name |
| `.fallback_families` | `"sans-serif"` | Fallback stack |
| `.style` | `"normal"` | normal or italic |
| `.weight` | `400` | Numeric weight |
| `.variants` | (object) | Available variants |

Dawn also uses `{{ settings.type_header_font | font_face }}` in a `<style>`
tag to generate the `@font-face` declarations for Shopify-hosted fonts.

### Where the variables get consumed: base.css / component CSS

In `assets/base.css` and component files, Dawn uses these variables:

```css
/* base.css */
body {
  font-family: var(--font-body-family);
  font-style: var(--font-body-style);
  font-weight: var(--font-body-weight);
  color: rgb(var(--color-foreground));
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading-family);
  font-style: var(--font-heading-style);
  font-weight: var(--font-heading-weight);
}

.page-width {
  max-width: var(--page-width);
  margin: 0 auto;
  padding: 0 1.5rem;
}

.button {
  border-radius: var(--buttons-radius);
  border-width: var(--buttons-border-width);
}

.section-padding {
  padding-top: var(--spacing-sections-desktop);
  padding-bottom: var(--spacing-sections-desktop);
}

@media screen and (max-width: 749px) {
  .section-padding {
    padding-top: var(--spacing-sections-mobile);
    padding-bottom: var(--spacing-sections-mobile);
  }
}
```

---

## 3. Complete Variable Categories for a Premium Shopify Theme

Below is a comprehensive taxonomy. Items marked **(E)** are typically exposed
to merchants in the editor. Items marked **(D)** are dev-only CSS variables.

### 3.1 Layout

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--page-width` | `1200px` | **(E)** range 1000-1600 |
| `--page-width-narrow` | `800px` | (D) |
| `--grid-desktop-horizontal-spacing` | `2rem` | (D) or (E) |
| `--grid-desktop-vertical-spacing` | `2rem` | (D) |
| `--grid-mobile-horizontal-spacing` | `1rem` | (D) |
| `--grid-mobile-vertical-spacing` | `1rem` | (D) |
| `--sidebar-width` | `280px` | (D) |
| `--grid-columns` | `12` | (D) |

### 3.2 Spacing

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--spacing-sections-desktop` | `36px` - `100px` | **(E)** range |
| `--spacing-sections-mobile` | auto-derived | (D) |
| `--spacing-unit` | `0.25rem` | (D) |
| `--spacing-1` through `--spacing-12` | `0.25rem` - `3rem` | (D) scale |

### 3.3 Typography

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--font-body-family` | `"Assistant", sans-serif` | **(E)** font_picker |
| `--font-body-style` | `normal` | auto from font_picker |
| `--font-body-weight` | `400` | auto from font_picker |
| `--font-heading-family` | `"Playfair Display", serif` | **(E)** font_picker |
| `--font-heading-style` | `normal` | auto from font_picker |
| `--font-heading-weight` | `700` | auto from font_picker |
| `--font-body-scale` | `1.0` | **(E)** range (100-130, shown as %) |
| `--font-heading-scale` | `1.0` | **(E)** range (100-150, shown as %) |
| `--font-size-base` | `1.6rem` | (D) |
| `--font-size-xs` | `1.2rem` | (D) |
| `--font-size-sm` | `1.4rem` | (D) |
| `--font-size-lg` | `1.8rem` | (D) |
| `--font-size-xl` | `2.4rem` | (D) |
| `--font-size-h1` | `4rem` | (D) |
| `--font-size-h2` | `3.2rem` | (D) |
| `--font-size-h3` | `2.4rem` | (D) |
| `--font-size-h4` | `2rem` | (D) |
| `--line-height-body` | `1.6` | (D) or (E) |
| `--line-height-heading` | `1.2` | (D) |
| `--letter-spacing-heading` | `0.06rem` | (D) |

### 3.4 Colors

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--color-foreground` | `18, 18, 18` (RGB) | **(E)** color |
| `--color-background` | `255, 255, 255` | **(E)** color |
| `--color-primary` | `18, 18, 18` | **(E)** color |
| `--color-secondary` | `51, 79, 180` | **(E)** color |
| `--color-accent` | `... ` | **(E)** color |
| `--color-border` | derived from foreground | (D) |
| `--color-border-opacity` | `0.1` | (D) or (E) |
| `--color-shadow` | derived from foreground | (D) |
| `--color-button` | alias of primary | (D) |
| `--color-button-text` | contrast of primary | (D) |
| `--color-link` | alias of primary | (D) |
| `--color-badge-background` | `... ` | (D) |
| `--color-badge-foreground` | `... ` | (D) |

**Dawn's color_scheme_group system (modern approach):**

Since Online Store 2.0 themes (late 2023+), Dawn uses `color_scheme_group`
to let merchants define **multiple named color schemes** (Scheme 1, Scheme 2,
etc.), each with roles like `background`, `text`, `button`, `button_label`,
`secondary_button_label`, `shadow`. Individual sections then pick which scheme
to use via a `color_scheme` setting. This generates CSS like:

```css
.color-scheme-1 {
  --color-background: 255, 255, 255;
  --color-foreground: 18, 18, 18;
  --color-primary-button: 18, 18, 18;
  --color-primary-button-label: 255, 255, 255;
  /* etc. */
}
```

### 3.5 Shape & Decoration

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--buttons-radius` | `0px` - `40px` | **(E)** range |
| `--buttons-border-width` | `0px` - `2px` | **(E)** range |
| `--buttons-border-opacity` | `1` | **(E)** range |
| `--inputs-radius` | `0px` | **(E)** range |
| `--inputs-border-width` | `1px` | **(E)** range |
| `--inputs-border-opacity` | `1` | **(E)** range |
| `--card-corner-radius` | `0rem` - `2rem` | **(E)** range |
| `--card-border-width` | `0rem` | **(E)** range |
| `--card-border-opacity` | `1` | **(E)** range |
| `--card-shadow-opacity` | `0` - `1` | **(E)** range |
| `--card-shadow-horizontal-offset` | `0rem` | **(E)** range |
| `--card-shadow-vertical-offset` | `0.4rem` | **(E)** range |
| `--card-shadow-blur-radius` | `0.5rem` | **(E)** range |
| `--badge-corner-radius` | `4rem` | **(E)** range |
| `--popup-corner-radius` | `0.4rem` | (D) |

### 3.6 Buttons (beyond shape)

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--button-padding-y` | `1rem` | (D) |
| `--button-padding-x` | `3rem` | (D) |
| `--button-font-size` | `1.4rem` | (D) |
| `--button-font-weight` | `700` | (D) |
| `--button-letter-spacing` | `0.1rem` | (D) |
| `--button-text-transform` | `uppercase` / `none` | (D) or (E) select |

### 3.7 Animation / Transitions

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--duration-short` | `100ms` | (D) |
| `--duration-default` | `200ms` | (D) |
| `--duration-long` | `500ms` | (D) |
| `--duration-extra-long` | `600ms` | (D) |
| `--ease-default` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | (D) |
| `--ease-in-out` | `cubic-bezier(0.42, 0, 0.58, 1)` | (D) |
| `--animation-slide-in` | defined via @keyframes | (D) |

Dawn exposes one animation-related setting: `announcement_bar_speed` as a
range for the marquee auto-rotation.

### 3.8 Component-Specific

| Variable | Example value | Exposed? |
|----------|--------------|----------|
| `--header-height` | (computed via JS) | (D) |
| `--announcement-bar-height` | (computed via JS) | (D) |
| `--sticky-header-offset` | (computed) | (D) |
| `--drawer-width` | `38rem` | (D) |
| `--modal-width` | `60rem` | (D) |
| `--product-card-image-ratio` | `1` / `0.75` | **(E)** select |
| `--media-border-opacity` | `0.05` | (D) |
| `--image-placeholder-color` | `#f3f3f3` | (D) |
| `--nav-item-padding` | `1.2rem` | (D) |
| `--footer-padding` | `3.6rem` | (D) |
| `--badge-padding-y` | `0.4rem` | (D) |
| `--badge-padding-x` | `0.8rem` | (D) |

---

## 4. Merchant-Facing (E) vs Dev-Only (D) -- Summary

### Merchant-facing settings (visible in Theme Editor)

These always go in `settings_schema.json` and use Shopify's input types:

1. **Colors** -- `color` / `color_scheme` / `color_scheme_group`
2. **Fonts** -- `font_picker` (body + heading, sometimes a third accent font)
3. **Font scale** -- `range` (percentage slider, e.g., 100%-150%)
4. **Page width** -- `range` (e.g., 1000px-1600px)
5. **Section spacing** -- `range` (desktop; mobile auto-derived)
6. **Button border radius** -- `range`
7. **Button border width/opacity** -- `range`
8. **Input border radius/width/opacity** -- `range`
9. **Card corner radius / border / shadow** -- `range` (multiple sub-settings)
10. **Badge corner radius** -- `range`
11. **Social media links** -- `text` (URLs for Facebook, Twitter, etc.)
12. **Favicon** -- `image_picker`
13. **Currency/format preferences** -- `checkbox`
14. **Cart type** -- `select` (drawer, page, notification)

### Dev-only CSS variables (never in settings_schema.json)

These are hardcoded in CSS or in the `{% style %}` block without a
corresponding setting:

1. **All font sizes** (h1-h6, base, xs, sm, lg, xl)
2. **Line heights and letter spacing**
3. **Spacing scale** (--spacing-1 through --spacing-12)
4. **Grid gutter values** (in Dawn; some premium themes expose these)
5. **Animation durations and easing curves**
6. **Component dimensions** (header height, drawer width, modal width)
7. **Breakpoint values** (defined in CSS media queries, not variables)
8. **Z-index values**
9. **Opacity tokens** (beyond what's exposed for cards/buttons)

### Design philosophy

Shopify's guidance is: **expose only what a non-technical merchant should
control**. Spacing tokens, type scales, and grid systems are considered
developer concerns. Colors, fonts, and "shape" (radius/border) are
merchant-friendly.

---

## 5. Responsive Values -- How Breakpoints Work

### Short answer: There is NO built-in Shopify mechanism for per-breakpoint setting values.

Shopify's settings system provides a **single value** per setting. Themes
handle responsiveness entirely in CSS.

### How Dawn does it

**Pattern 1: Compute a mobile value from the desktop value in Liquid**

```liquid
--spacing-sections-desktop: {{ settings.spacing_sections | times: 10 }}px;
--spacing-sections-mobile: {{ settings.spacing_sections | times: 7.5 }}px;
```

The merchant sets ONE value; the theme derives the mobile value using a
ratio (here, mobile = 75% of desktop).

**Pattern 2: CSS media queries swap between variables**

```css
.section-padding {
  padding-top: var(--spacing-sections-desktop);
  padding-bottom: var(--spacing-sections-desktop);
}

@media screen and (max-width: 749px) {
  .section-padding {
    padding-top: var(--spacing-sections-mobile);
    padding-bottom: var(--spacing-sections-mobile);
  }
}
```

**Pattern 3: CSS clamp() for fluid typography/spacing**

Premium themes often use `clamp()` for fluid scaling without breakpoints:

```css
h1 {
  font-size: calc(var(--font-size-h1) * var(--font-heading-scale));
  /* or fluid: */
  font-size: clamp(2.4rem, calc(2.4rem + 1.6 * ((100vw - 375px) / 1145)), 4rem);
}
```

**Pattern 4: Section-level padding settings**

Dawn also allows per-section padding via section schemas:

```json
{
  "type": "range",
  "id": "padding_top",
  "min": 0,
  "max": 100,
  "step": 4,
  "unit": "px",
  "label": "Top padding",
  "default": 36
}
```

These are per-section, not global, and still a single value that the CSS
adapts for mobile.

### Dawn's breakpoints (hardcoded in CSS, NOT in settings)

```
749px  -- mobile / tablet break
989px  -- tablet / desktop break
```

These are never exposed to merchants and not stored as CSS custom properties.

### Summary for your wireframe builder

If you want per-breakpoint control, you would need to either:
- Define two settings per value (desktop + mobile) -- clutters the UI
- Define one setting and auto-derive mobile via a ratio -- Dawn's approach
- Use CSS `clamp()` with a single setting as the max
- Build a custom admin interface (not the native theme editor)

---

## 6. Shopify Polaris

### What it is

Polaris is Shopify's **design system and React component library** for
building:
- Shopify admin apps (embedded apps)
- Custom admin interfaces
- Internal Shopify tools

### NPM package

```
@shopify/polaris           (React components)
@shopify/polaris-tokens    (design tokens: colors, spacing, typography)
@shopify/polaris-icons     (icon set)
```

### Key components relevant to a wireframe builder tool

| Component | Use case |
|-----------|----------|
| `ColorPicker` | Color selection UI |
| `RangeSlider` | Numeric range input |
| `Select` | Dropdown |
| `TextField` | Text input |
| `Button`, `ButtonGroup` | Actions |
| `Card` | Content grouping |
| `Layout`, `Layout.Section` | Page layout |
| `Page` | Page wrapper with title/actions |
| `Tabs` | Tabbed navigation |
| `Collapsible` | Expandable sections |
| `ChoiceList` | Radio/checkbox groups |
| `Popover` | Dropdown menus, pickers |
| `Modal` | Dialogs |
| `Frame`, `Navigation` | App chrome |
| `ContextualSaveBar` | "Save" bar at top |
| `Toast` | Notifications |
| `DataTable` | Tabular data |
| `ResourceList` | Lists of resources |
| `Thumbnail` | Image preview |
| `Stack` (or `InlineStack` / `BlockStack` in v12+) | Flex layout primitives |
| `Grid` | CSS grid wrapper |

### Can you use Polaris for a custom tool/admin interface?

**Yes, absolutely.** Polaris is designed for exactly this. You can use it in:

1. **Shopify embedded apps** (displayed inside the Shopify admin via App
   Bridge) -- this is the primary use case.
2. **Standalone web apps** -- Polaris components work in any React app. You
   just won't get the Shopify admin chrome/context.
3. **A wireframe builder** -- Polaris provides all the form controls you'd
   need to replicate the theme editor experience.

### Polaris design tokens

`@shopify/polaris-tokens` provides tokens for:
- Colors (surface, text, interactive, critical, warning, success, etc.)
- Typography (font families, sizes, weights, line heights)
- Spacing (scale from 0 to 12)
- Border (radius, width)
- Shadow (sm, md, lg, xl, 2xl)
- Motion (duration, easing)
- Z-index (layers)
- Breakpoints (xs, sm, md, lg, xl)

These tokens are available as CSS custom properties (`--p-color-bg`,
`--p-space-4`, etc.) and as JavaScript values.

### Key limitations

- Polaris is React-only. No Vue/Svelte/vanilla versions.
- For an embedded Shopify app, you also need `@shopify/app-bridge-react`.
- Polaris follows Shopify admin aesthetics, which may or may not match
  your wireframe builder's desired look.

---

## 7. Practical Recommendations for a Wireframe Builder Tool

### Architecture suggestion

```
settings_schema.json  (defines what merchants can customize)
        |
        v
   Liquid template    (reads settings, writes CSS custom properties)
        |
        v
   :root { --vars }   (CSS custom properties on the page)
        |
        v
   CSS stylesheets    (consume the variables)
```

For your wireframe builder, replicate this pipeline:

1. **Define a settings model** mirroring settings_schema.json structure
2. **Generate CSS custom properties** from those settings (the Liquid step)
3. **Apply CSS that consumes those properties** to render the preview

### Minimum viable settings for a wireframe builder

```jsonc
{
  // Layout
  "page_width": 1200,           // range: 1000-1600, step 8

  // Colors (store as hex, convert to RGB triplets for CSS)
  "color_background": "#ffffff",
  "color_foreground": "#121212",
  "color_primary": "#121212",
  "color_secondary": "#334fb4",
  "color_accent": "#ff6b35",

  // Typography
  "font_body": "Assistant",     // + weight, style
  "font_heading": "Playfair Display",
  "font_body_scale": 100,       // range 100-130
  "font_heading_scale": 100,    // range 100-150

  // Spacing
  "section_spacing": 40,        // range 0-100, step 4

  // Shape
  "button_radius": 0,           // range 0-40
  "card_radius": 0,             // range 0-40
  "input_radius": 0,            // range 0-40

  // Shadows
  "card_shadow_opacity": 0,
  "card_shadow_blur": 5,
  "card_shadow_offset_y": 4
}
```

### CSS output template

```css
:root {
  /* Layout */
  --page-width: ${page_width}px;

  /* Colors (as RGB triplets for alpha compositing) */
  --color-background: ${hexToRGB(color_background)};
  --color-foreground: ${hexToRGB(color_foreground)};
  --color-primary: ${hexToRGB(color_primary)};
  --color-secondary: ${hexToRGB(color_secondary)};
  --color-accent: ${hexToRGB(color_accent)};

  /* Typography */
  --font-body-family: "${font_body}", sans-serif;
  --font-heading-family: "${font_heading}", serif;
  --font-body-scale: ${font_body_scale / 100};
  --font-heading-scale: ${font_heading_scale / 100};

  /* Spacing */
  --spacing-sections-desktop: ${section_spacing * 10}px;
  --spacing-sections-mobile: ${section_spacing * 7.5}px;

  /* Shape */
  --buttons-radius: ${button_radius}px;
  --card-corner-radius: ${card_radius / 10}rem;
  --inputs-radius: ${input_radius}px;

  /* Shadows */
  --card-shadow: ${card_shadow_offset_y/10}rem ${card_shadow_blur/10}rem rgba(var(--color-foreground), ${card_shadow_opacity/100});

  /* Dev-only (hardcoded) */
  --duration-short: 100ms;
  --duration-default: 200ms;
  --grid-desktop-horizontal-spacing: 2rem;
  --grid-mobile-horizontal-spacing: 1rem;
}
```

---

## Appendix: Dawn's Actual settings_schema.json Groups

For reference, Dawn organizes its settings into these groups:

1. **theme_info** -- metadata
2. **Logo** -- logo image, width
3. **Colors** -- color_scheme_group (with roles: background, text, solid_button_labels, secondary_button_labels, shadow)
4. **Typography** -- font_picker x2, range x2 (heading scale, body scale)
5. **Layout** -- range (page_width), range (section spacing), range (grid spacing)
6. **Buttons** -- range (border radius, border width, border opacity, shadow opacity, shadow offsets)
7. **Inputs** -- range (border radius, border width, border opacity, shadow)
8. **Cards** -- range (corner radius, border width, border opacity, shadow opacity, shadow offsets, shadow blur)
9. **Content containers** -- similar shape settings
10. **Media** -- border opacity, shadow
11. **Dropdowns and pop-ups** -- corner radius, border, shadow
12. **Drawers** -- border, shadow
13. **Badges** -- corner radius, color
14. **Brand information** -- richtext, image
15. **Social media** -- text inputs for platform URLs
16. **Search** -- checkbox (predictive search), select (behavior)
17. **Favicon** -- image_picker
18. **Currency format** -- checkbox
19. **Cart** -- select (cart type: drawer/page/notification)

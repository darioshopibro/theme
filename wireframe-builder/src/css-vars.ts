import { ThemeSettings } from './types';

function hexToRGB(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// Generate CSS custom properties from theme settings (mirrors Shopify's theme.liquid pattern)
export function settingsToCSS(s: ThemeSettings): Record<string, string> {
  return {
    // Layout
    '--page-width': `${s.page_width}px`,

    // Colors (RGB triplets for alpha compositing)
    '--color-background': hexToRGB(s.color_background),
    '--color-foreground': hexToRGB(s.color_foreground),
    '--color-primary': hexToRGB(s.color_primary),
    '--color-secondary': hexToRGB(s.color_secondary),
    '--color-accent': hexToRGB(s.color_accent),

    // Typography
    '--font-heading-family': `"${s.font_heading}", serif`,
    '--font-body-family': `"${s.font_body}", sans-serif`,
    '--font-heading-scale': `${s.font_heading_scale / 100}`,
    '--font-body-scale': `${s.font_body_scale / 100}`,

    // Spacing (Dawn pattern: mobile = desktop * 0.75)
    '--spacing-sections-desktop': `${s.section_spacing * 10}px`,
    '--spacing-sections-mobile': `${Math.round(s.section_spacing * 7.5)}px`,

    // Buttons
    '--buttons-radius': `${s.button_radius}px`,
    '--buttons-border-width': `${s.button_border_width}px`,
    '--button-text-transform': s.button_text_transform,

    // Inputs
    '--inputs-radius': `${s.input_radius}px`,
    '--inputs-border-width': `${s.input_border_width}px`,

    // Cards
    '--card-corner-radius': `${s.card_radius}px`,
    '--card-border-width': `${s.card_border_width}px`,
    '--card-shadow': `0 ${s.card_shadow_offset_y}px ${s.card_shadow_blur}px rgba(0,0,0,${s.card_shadow_opacity / 100})`,

    // Badge
    '--badge-corner-radius': `${s.badge_radius}px`,

    // Dev-only (hardcoded)
    '--duration-short': '100ms',
    '--duration-default': '200ms',
    '--duration-long': '500ms',
    '--grid-desktop-horizontal-spacing': '2rem',
    '--grid-mobile-horizontal-spacing': '1rem',
  };
}

// Generate Google Fonts import URL
export function getFontImportUrl(fonts: string[]): string {
  const families = fonts.map(f => f.replace(/ /g, '+')).join('&family=');
  return `https://fonts.googleapis.com/css2?family=${families}:wght@300;400;500;600;700&display=swap`;
}

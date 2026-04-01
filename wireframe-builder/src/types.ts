// === Theme Settings (maps to Shopify settings_schema.json) ===

export interface ThemeSettings {
  page_width: number;
  color_background: string;
  color_foreground: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  font_heading: string;
  font_body: string;
  font_heading_scale: number;
  font_body_scale: number;
  section_spacing: number;
  button_radius: number;
  button_border_width: number;
  button_text_transform: 'none' | 'uppercase';
  input_radius: number;
  input_border_width: number;
  card_radius: number;
  card_border_width: number;
  card_shadow_opacity: number;
  card_shadow_blur: number;
  card_shadow_offset_y: number;
  badge_radius: number;
}

// === Section Settings (per section customization) ===

export interface SectionSettings {
  heading?: string;
  subheading?: string;
  columns?: number;
  rows?: number;
  bg_color?: string;
  text_align?: 'left' | 'center' | 'right';
  full_width?: boolean;
  show_badge?: boolean;
  badge_text?: string;
  button_text?: string;
  button_style?: 'solid' | 'outline' | 'link';
  image_ratio?: '1:1' | '3:4' | '4:3' | '16:9';
  content_position?: 'left' | 'center' | 'right';
  overlay_opacity?: number;
  products_count?: number;
  show_price?: boolean;
  show_vendor?: boolean;
}

// === Section types ===

export interface ImportedBlock {
  id: string;
  tag: string;
  html: string;
  text: string;
  height: number;
  visible: boolean;
}

export interface SectionGroup {
  id: string;
  name: string;
  color: string;
  sections: ThemeSection[];
}

export const GROUP_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

export type PageType = 'homepage' | 'collection' | 'product';

export interface ThemeSection {
  id: string;
  type: string;
  heading: string | null;
  visible: boolean;
  order: number;
  height: number;
  settings: SectionSettings;
  importedHtml?: string;  // filename of extracted HTML
  importedBlocks?: ImportedBlock[];  // parsed blocks for editing
}

export interface PageLayout {
  type: PageType;
  sections: ThemeSection[];
}

export interface ThemeConfig {
  name: string;
  niche: string;
  settings: ThemeSettings;
  pages: PageLayout[];
}

// === Settings metadata ===

export type SettingType = 'range' | 'color' | 'select' | 'font';

export interface SettingMeta {
  id: keyof ThemeSettings;
  label: string;
  type: SettingType;
  group: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
}

export const SETTINGS_META: SettingMeta[] = [
  { id: 'page_width', label: 'Page width', type: 'range', group: 'Layout', min: 1000, max: 1600, step: 8, unit: 'px' },
  { id: 'color_background', label: 'Background', type: 'color', group: 'Colors' },
  { id: 'color_foreground', label: 'Text', type: 'color', group: 'Colors' },
  { id: 'color_primary', label: 'Primary', type: 'color', group: 'Colors' },
  { id: 'color_secondary', label: 'Secondary', type: 'color', group: 'Colors' },
  { id: 'color_accent', label: 'Accent', type: 'color', group: 'Colors' },
  { id: 'font_heading', label: 'Heading', type: 'font', group: 'Typography' },
  { id: 'font_body', label: 'Body', type: 'font', group: 'Typography' },
  { id: 'font_heading_scale', label: 'Heading scale', type: 'range', group: 'Typography', min: 100, max: 150, step: 5, unit: '%' },
  { id: 'font_body_scale', label: 'Body scale', type: 'range', group: 'Typography', min: 100, max: 130, step: 5, unit: '%' },
  { id: 'section_spacing', label: 'Section gap', type: 'range', group: 'Spacing', min: 0, max: 100, step: 4, unit: 'px' },
  { id: 'button_radius', label: 'Radius', type: 'range', group: 'Buttons', min: 0, max: 40, step: 1, unit: 'px' },
  { id: 'button_border_width', label: 'Border', type: 'range', group: 'Buttons', min: 0, max: 3, step: 1, unit: 'px' },
  { id: 'button_text_transform', label: 'Text', type: 'select', group: 'Buttons', options: [{ value: 'none', label: 'Normal' }, { value: 'uppercase', label: 'UPPER' }] },
  { id: 'input_radius', label: 'Radius', type: 'range', group: 'Inputs', min: 0, max: 40, step: 1, unit: 'px' },
  { id: 'input_border_width', label: 'Border', type: 'range', group: 'Inputs', min: 0, max: 3, step: 1, unit: 'px' },
  { id: 'card_radius', label: 'Radius', type: 'range', group: 'Cards', min: 0, max: 40, step: 1, unit: 'px' },
  { id: 'card_border_width', label: 'Border', type: 'range', group: 'Cards', min: 0, max: 3, step: 1, unit: 'px' },
  { id: 'card_shadow_opacity', label: 'Shadow', type: 'range', group: 'Cards', min: 0, max: 100, step: 5, unit: '%' },
  { id: 'card_shadow_blur', label: 'Blur', type: 'range', group: 'Cards', min: 0, max: 50, step: 1, unit: 'px' },
  { id: 'card_shadow_offset_y', label: 'Offset Y', type: 'range', group: 'Cards', min: 0, max: 20, step: 1, unit: 'px' },
  { id: 'badge_radius', label: 'Radius', type: 'range', group: 'Badges', min: 0, max: 40, step: 1, unit: 'px' },
];

export const DEFAULT_SETTINGS: ThemeSettings = {
  page_width: 1200,
  color_background: '#ffffff',
  color_foreground: '#121212',
  color_primary: '#121212',
  color_secondary: '#334fb4',
  color_accent: '#ff6b35',
  font_heading: 'Playfair Display',
  font_body: 'Inter',
  font_heading_scale: 100,
  font_body_scale: 100,
  section_spacing: 40,
  button_radius: 0,
  button_border_width: 1,
  button_text_transform: 'none',
  input_radius: 0,
  input_border_width: 1,
  card_radius: 0,
  card_border_width: 0,
  card_shadow_opacity: 0,
  card_shadow_blur: 5,
  card_shadow_offset_y: 4,
  badge_radius: 40,
};

export const DEFAULT_SECTION_SETTINGS: SectionSettings = {
  heading: '',
  subheading: '',
  columns: 4,
  text_align: 'center',
  full_width: false,
  button_text: 'Shop Now',
  button_style: 'solid',
  image_ratio: '1:1',
  content_position: 'center',
  overlay_opacity: 0,
  products_count: 4,
  show_price: true,
  show_vendor: false,
};

export const FONT_OPTIONS = [
  'Inter', 'Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Lato',
  'Poppins', 'Raleway', 'Oswald', 'Nunito', 'Source Sans 3',
  'Merriweather', 'Ubuntu', 'Rubik', 'Work Sans', 'DM Sans',
  'Josefin Sans', 'Assistant', 'Archivo', 'Space Grotesk', 'Outfit', 'Sora',
];

// Section type definitions with their editable settings
export interface SectionTypeDef {
  label: string;
  defaultHeight: number;
  pages: PageType[];
  editableSettings: (keyof SectionSettings)[];
}

export const SECTION_TEMPLATES: Record<string, SectionTypeDef> = {
  'announcement-bar': { label: 'Announcement Bar', defaultHeight: 40, pages: ['homepage', 'collection', 'product'], editableSettings: ['heading', 'bg_color'] },
  'header': { label: 'Header', defaultHeight: 80, pages: ['homepage', 'collection', 'product'], editableSettings: [] },
  'hero': { label: 'Hero Banner', defaultHeight: 500, pages: ['homepage'], editableSettings: ['heading', 'subheading', 'button_text', 'button_style', 'content_position', 'overlay_opacity', 'full_width'] },
  'trust-badges': { label: 'Trust Badges', defaultHeight: 80, pages: ['homepage'], editableSettings: ['text_align'] },
  'featured-collection': { label: 'Featured Collection', defaultHeight: 400, pages: ['homepage'], editableSettings: ['heading', 'columns', 'products_count', 'show_price', 'show_vendor', 'image_ratio'] },
  'collection-tabs': { label: 'Collection Tabs', defaultHeight: 450, pages: ['homepage'], editableSettings: ['heading', 'columns', 'products_count'] },
  'media-with-text': { label: 'Media with Text', defaultHeight: 350, pages: ['homepage'], editableSettings: ['heading', 'subheading', 'content_position', 'button_text'] },
  'featured-products-grid': { label: 'Products Grid', defaultHeight: 600, pages: ['homepage'], editableSettings: ['heading', 'columns', 'rows', 'products_count', 'show_price', 'show_vendor'] },
  'testimonials': { label: 'Testimonials', defaultHeight: 300, pages: ['homepage'], editableSettings: ['heading', 'columns'] },
  'newsletter': { label: 'Newsletter', defaultHeight: 250, pages: ['homepage', 'product'], editableSettings: ['heading', 'subheading', 'button_text'] },
  'featured-blog': { label: 'Blog Posts', defaultHeight: 350, pages: ['homepage'], editableSettings: ['heading', 'columns'] },
  'logo-list': { label: 'Logo List', defaultHeight: 150, pages: ['homepage'], editableSettings: ['heading'] },
  'press': { label: 'Press', defaultHeight: 200, pages: ['homepage'], editableSettings: ['heading'] },
  'rich-text': { label: 'Rich Text', defaultHeight: 200, pages: ['homepage', 'collection'], editableSettings: ['heading', 'subheading', 'text_align'] },
  'image-gallery': { label: 'Image Gallery', defaultHeight: 400, pages: ['homepage'], editableSettings: ['heading', 'columns', 'image_ratio'] },
  'shop-the-look': { label: 'Shop the Look', defaultHeight: 400, pages: ['homepage'], editableSettings: ['heading'] },
  'countdown': { label: 'Countdown', defaultHeight: 150, pages: ['homepage'], editableSettings: ['heading', 'subheading'] },
  'video': { label: 'Video', defaultHeight: 400, pages: ['homepage'], editableSettings: ['heading'] },
  'multicolumn': { label: 'Multi-column', defaultHeight: 300, pages: ['homepage', 'collection'], editableSettings: ['heading', 'columns'] },
  'collection-icons': { label: 'Collection Icons', defaultHeight: 250, pages: ['homepage', 'collection'], editableSettings: ['heading', 'columns'] },
  'footer': { label: 'Footer', defaultHeight: 300, pages: ['homepage', 'collection', 'product'], editableSettings: [] },
  'collection-banner': { label: 'Collection Banner', defaultHeight: 250, pages: ['collection'], editableSettings: ['heading', 'subheading', 'overlay_opacity'] },
  'breadcrumb': { label: 'Breadcrumb', defaultHeight: 40, pages: ['collection', 'product'], editableSettings: [] },
  'main-collection': { label: 'Product Grid', defaultHeight: 800, pages: ['collection'], editableSettings: ['columns', 'products_count', 'show_price', 'show_vendor', 'image_ratio'] },
  'product-main': { label: 'Product Info', defaultHeight: 600, pages: ['product'], editableSettings: ['image_ratio', 'show_vendor'] },
  'product-description': { label: 'Product Tabs', defaultHeight: 300, pages: ['product'], editableSettings: [] },
  'related-products': { label: 'Related Products', defaultHeight: 350, pages: ['product'], editableSettings: ['heading', 'columns', 'products_count'] },
  'recently-viewed': { label: 'Recently Viewed', defaultHeight: 300, pages: ['product'], editableSettings: ['heading', 'columns'] },
};

// Section preview descriptions
export const SECTION_PREVIEWS: Record<string, string> = {
  'announcement-bar': '📢 Promo banner',
  'header': '🔝 Logo + nav + cart',
  'hero': '🖼 Full-width hero + CTA',
  'trust-badges': '✅ Shipping, returns, etc',
  'featured-collection': '🛍 Product grid',
  'collection-tabs': '📑 Tabbed collections',
  'media-with-text': '📰 Image + text',
  'featured-products-grid': '⊞ Large product grid',
  'testimonials': '💬 Review cards',
  'newsletter': '📧 Email signup',
  'featured-blog': '📝 Blog cards',
  'logo-list': '🏢 Partner logos',
  'press': '📰 Press mentions',
  'rich-text': '📄 Text block',
  'image-gallery': '🖼 Gallery',
  'shop-the-look': '👀 Shoppable image',
  'countdown': '⏰ Sale timer',
  'video': '▶️ Video',
  'multicolumn': '▥ Multi-column',
  'collection-icons': '🏷 Category icons',
  'footer': '⬇ Footer',
  'collection-banner': '🏔 Collection header',
  'breadcrumb': '🔗 Breadcrumb',
  'main-collection': '🛒 Grid + filters',
  'product-main': '📦 Product + add to cart',
  'product-description': '📋 Description tabs',
  'related-products': '🔗 Related products',
  'recently-viewed': '👁 Recently viewed',
};

import React, { useState } from 'react';
import { ThemeSettings, ThemeSection, SECTION_TEMPLATES, SECTION_PREVIEWS } from './types';
import { settingsToCSS } from './css-vars';
import { Trash2, EyeOff, GripVertical, RotateCcw, Paintbrush } from 'lucide-react';
import { useZoom } from './ZoomContext';

interface Props {
  section: ThemeSection;
  settings: ThemeSettings;
  isMobile: boolean;
  onRemove: () => void;
  onToggleVisibility: () => void;
  onExtractToCanvas?: () => void;
  onResize?: (height: number) => void;
  isSelected?: boolean;
}


const SectionBlock: React.FC<Props> = ({ section, settings, isMobile, onRemove, onToggleVisibility, onExtractToCanvas, onResize, isSelected }) => {
  const [hovered, setHovered] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [resizing, setResizing] = useState(false);
  const zoom = useZoom();
  const counterScale = Math.max(1, 1 / zoom);
  const [localHeight, setLocalHeight] = useState(section.height);
  const resizeStartY = React.useRef(0);
  const resizeStartH = React.useRef(0);

  // Sync with prop
  React.useEffect(() => { setLocalHeight(section.height); }, [section.height]);

  const localHeightRef = React.useRef(localHeight);
  localHeightRef.current = localHeight;

  // Resize drag handler — divide delta by zoom for canvas-aware resize
  React.useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = (e.clientY - resizeStartY.current) / zoom;
      const newH = Math.max(50, resizeStartH.current + delta);
      setLocalHeight(newH);
      localHeightRef.current = newH;
    };
    const onUp = () => {
      setResizing(false);
      if (onResize) onResize(localHeightRef.current);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing, onResize, zoom]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartH.current = localHeight;
  };

  const css = settingsToCSS(settings);
  const template = SECTION_TEMPLATES[section.type];
  const height = localHeight || template?.defaultHeight || 200;
  const fg = css['--color-foreground'];
  const primary = css['--color-primary'];
  const bg = css['--color-background'];

  // Resize handle component
  const ResizeHandle = () => (
    <div
      draggable={false}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startResize(e); }}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: 'absolute', bottom: -6, left: 0, right: 0, height: 18,
        cursor: 'ns-resize', zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: 60, height: 4, borderRadius: 2,
        background: resizing ? '#6366f1' : '#d1d5db',
        transition: 'background 0.15s, width 0.15s',
        boxShadow: resizing ? '0 0 8px rgba(99,102,241,0.4)' : 'none',
      }}
        onMouseEnter={e => { if (!resizing) { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.width = '80px'; } }}
        onMouseLeave={e => { if (!resizing) { e.currentTarget.style.background = '#d1d5db'; e.currentTarget.style.width = '60px'; } }}
      />
    </div>
  );

  // If this is an imported section, render iframe
  if (section.importedHtml) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: '#fff',
          outline: isSelected ? '2px solid #6366f1' : hovered ? '2px solid #a5b4fc' : '2px solid transparent',
          outlineOffset: -2,
          height: height,
          overflow: 'hidden',
        }}
      >
        <iframe
          src={`http://localhost:3007/extracted/${section.importedHtml}`}
          style={{
            width: '100%', height: height, border: 'none',
            pointerEvents: 'none', overflow: 'hidden',
          }}
          title={section.type}
          scrolling="no"
        />
        <ResizeHandle />
        {hovered && (
          <div style={{
            position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, alignItems: 'center',
            background: '#fff', borderRadius: 6, padding: '3px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10, border: '1px solid #e5e7eb',
            transform: `scale(${counterScale})`, transformOrigin: 'top right',
          }}>
            <GripVertical size={12} color="#ccc" />
            <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, padding: '0 4px' }}>
              Imported: {section.type}
            </span>
            <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, display: 'flex' }} title="Remove">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Universal block renderer — when we have real extracted blocks, show them
  // Shared heading renderer
  const SectionHeading = ({ heading, sub }: { heading?: string; sub?: string }) => (
    <>
      {heading && (
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: section.settings.text_align || 'center', marginBottom: sub ? 4 : 16 }}>
          {heading}
        </div>
      )}
      {sub && <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, textAlign: section.settings.text_align || 'center', marginBottom: 16 }}>{sub}</div>}
    </>
  );

  // Product card renderer
  const ProductCard = ({ block }: { block: { heading?: string; description?: string; button_text?: string; has_image?: boolean } }) => {
    const parts = (block.description || '').split(' — ');
    const vendor = parts.length > 1 ? parts[0] : '';
    const priceInfo = parts.length > 1 ? parts[1] : parts[0] || '';
    const badge = parts.length > 2 ? parts[2] : '';
    const isSale = priceInfo.includes(' ');
    const prices = priceInfo.split(' ');

    return (
      <div style={{ borderRadius: css['--card-corner-radius'], overflow: 'hidden' }}>
        {block.has_image && (
          <div style={{ paddingTop: '100%', background: `rgba(${fg},0.04)`, position: 'relative' }}>
            {badge && (
              <span style={{
                position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700,
                padding: '2px 8px', borderRadius: 40,
                background: badge.includes('Sale') ? '#dc2626' : badge.includes('New') ? '#059669' : `rgba(${fg},0.1)`,
                color: badge.includes('Sale') || badge.includes('New') ? '#fff' : `rgb(${fg})`,
              }}>{badge}</span>
            )}
          </div>
        )}
        <div style={{ padding: '10px 0' }}>
          {vendor && <div style={{ fontSize: 9, color: `rgba(${fg},0.35)`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{vendor}</div>}
          {block.heading && <div style={{ fontSize: 12, fontWeight: 500, color: `rgb(${fg})`, marginTop: 2 }}>{block.heading}</div>}
          {isSale ? (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{prices[0]}</span>
              <span style={{ fontSize: 11, color: `rgba(${fg},0.3)`, textDecoration: 'line-through', marginLeft: 4 }}>{prices[1]}</span>
            </div>
          ) : priceInfo && (
            <div style={{ fontSize: 12, color: `rgba(${fg},0.6)`, marginTop: 4 }}>{priceInfo}</div>
          )}
        </div>
      </div>
    );
  };

  const renderBlocks = () => {
    const blocks = section.settings.blocks!;
    const sectionHeading = section.settings.heading || section.heading;

    // ── Hero / Carousel: slides with overlay text ──
    if (section.type === 'hero' && blocks.length > 0) {
      const [activeSlide, setActiveSlide] = React.useState(0);
      const slide = blocks[activeSlide] || blocks[0];
      const parts = (slide.description || '').split(' — ');
      const subtext = parts.length > 1 ? parts[1] : parts[0] || '';

      return (
        <div style={{ height: height || 500, position: 'relative', background: `rgba(${fg},0.08)`, overflow: 'hidden' }}>
          {/* Slide content */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', padding: 48,
            background: `rgba(${fg},${(section.settings.overlay_opacity || 40) / 100})`,
          }}>
            <div style={{
              fontSize: isMobile ? 24 : 36, fontWeight: 700, fontFamily: css['--font-heading-family'],
              color: `rgb(${bg})`, textAlign: 'center', lineHeight: 1.15, textTransform: 'uppercase',
            }}>
              {slide.heading}
            </div>
            {subtext && (
              <div style={{ fontSize: 13, color: `rgba(${bg},0.7)`, marginTop: 10, textAlign: 'center' }}>
                {subtext}
              </div>
            )}
            {slide.button_text && (
              <button style={{
                marginTop: 20, padding: '10px 28px', background: `rgb(${bg})`, color: `rgb(${fg})`,
                border: 'none', borderRadius: css['--buttons-radius'], fontSize: 13, fontWeight: 600,
              }}>{slide.button_text}</button>
            )}
          </div>

          {/* Slide indicators */}
          {blocks.length > 1 && (
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
              {blocks.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  style={{
                    width: i === activeSlide ? 20 : 8, height: 8, borderRadius: 4,
                    background: `rgba(${bg},${i === activeSlide ? 1 : 0.4})`,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>
          )}

          {/* Nav arrows */}
          {blocks.length > 1 && (
            <>
              <div onClick={() => setActiveSlide(i => (i - 1 + blocks.length) % blocks.length)}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, background: `rgba(${bg},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: `rgb(${bg})` }}>
                ‹
              </div>
              <div onClick={() => setActiveSlide(i => (i + 1) % blocks.length)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, background: `rgba(${bg},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: `rgb(${bg})` }}>
                ›
              </div>
            </>
          )}

          {/* Slide label */}
          <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 9, color: `rgba(${bg},0.5)`, fontWeight: 500 }}>
            {activeSlide + 1} / {blocks.length}
          </div>
        </div>
      );
    }

    // ── Shop the Look: image left + product list right ──
    if (section.type === 'shop-the-look') {
      return (
        <div style={{ padding: isMobile ? 16 : 24 }}>
          <SectionHeading heading={sectionHeading} />
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, background: `rgba(${fg},0.04)`, borderRadius: css['--card-corner-radius'], aspectRatio: '3/2', position: 'relative' }}>
              {[{ l: '10%', t: '70%' }, { l: '50%', t: '50%' }, { l: '75%', t: '85%' }].map((pos, i) => (
                <div key={i} style={{ position: 'absolute', left: pos.l, top: pos.t, width: 16, height: 16, borderRadius: 8, background: `rgb(${fg})`, border: `2px solid rgb(${bg})`, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
              ))}
            </div>
            <div style={{ width: 340, flexShrink: 0 }}>
              {blocks.map((block, i) => {
                const parts = (block.description || '').split(' — ');
                const variant = parts[0] || '';
                const priceStr = parts[1] || '';
                const prices = priceStr.split(' ');
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid rgba(${fg},0.08)`, alignItems: 'center' }}>
                    <input type="checkbox" checked readOnly style={{ width: 14, height: 14, accentColor: `rgb(${fg})` }} />
                    <div style={{ width: 56, height: 56, background: `rgba(${fg},0.04)`, borderRadius: css['--card-corner-radius'], flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: `rgb(${fg})` }}>{block.heading}</div>
                      <div style={{ fontSize: 10, color: `rgba(${fg},0.4)`, marginTop: 1 }}>{variant}</div>
                      <div style={{ marginTop: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{prices[0]}</span>
                        {prices[1] && <span style={{ fontSize: 10, color: `rgba(${fg},0.3)`, textDecoration: 'line-through', marginLeft: 4 }}>{prices[1]}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid rgba(${fg},0.1)`, borderRadius: css['--buttons-radius'], padding: '3px 8px' }}>
                      <span style={{ fontSize: 11, color: `rgba(${fg},0.3)` }}>-</span>
                      <span style={{ fontSize: 11, fontWeight: 500, minWidth: 14, textAlign: 'center' }}>1</span>
                      <span style={{ fontSize: 11, color: `rgba(${fg},0.3)` }}>+</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid rgba(${fg},0.08)` }}>
                <span style={{ fontSize: 13, color: `rgba(${fg},0.6)` }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: `rgb(${fg})` }}>$252.70</span>
              </div>
              <button style={{
                width: '100%', marginTop: 12, padding: '12px', background: `rgb(${primary})`, color: `rgb(${bg})`,
                border: 'none', borderRadius: css['--buttons-radius'], fontSize: 13, fontWeight: 600, fontFamily: css['--font-body-family'],
              }}>{section.settings.button_text || 'Add All to Cart'}</button>
            </div>
          </div>
        </div>
      );
    }

    // ── Featured Collection with info card ──
    if ((section.type === 'featured-collection' || section.type === 'featured-products-grid') && blocks[0] && !blocks[0].has_image) {
      const infoCard = blocks[0];
      const products = blocks.slice(1);
      const cols = isMobile ? 2 : Math.min(products.length + 1, 6);
      return (
        <div style={{ padding: isMobile ? 16 : 24 }}>
          <SectionHeading heading={sectionHeading} sub={section.settings.subheading} />
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
            <div style={{ background: `rgb(${fg})`, borderRadius: css['--card-corner-radius'], padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 240 }}>
              <div style={{ fontFamily: css['--font-heading-family'], fontSize: 16, fontWeight: 700, color: `rgb(${bg})`, lineHeight: 1.2 }}>{infoCard.heading}</div>
              <div style={{ fontSize: 11, color: `rgba(${bg},0.6)`, marginTop: 6 }}>{infoCard.description}</div>
              {infoCard.button_text && <button style={{ marginTop: 14, padding: '7px 14px', background: `rgb(${bg})`, color: `rgb(${fg})`, border: 'none', borderRadius: css['--buttons-radius'], fontSize: 11, fontWeight: 600, alignSelf: 'flex-start' }}>{infoCard.button_text}</button>}
            </div>
            {products.map((block, n) => <ProductCard key={n} block={block} />)}
          </div>
        </div>
      );
    }

    // ── Collection tabs ──
    if (section.type === 'collection-tabs' && sectionHeading && sectionHeading.includes('|')) {
      const tabs = sectionHeading.split('|').map(t => t.trim());
      const cols = isMobile ? 2 : (section.settings.columns || 4);
      return (
        <div style={{ padding: isMobile ? 16 : 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            {tabs.map((tab, i) => (
              <div key={i} style={{
                padding: '6px 16px', fontSize: 11, fontWeight: i === 0 ? 700 : 400, borderRadius: css['--buttons-radius'],
                background: i === 0 ? `rgb(${primary})` : 'transparent', color: i === 0 ? `rgb(${bg})` : `rgba(${fg},0.5)`,
                border: i === 0 ? 'none' : `1px solid rgba(${fg},0.1)`,
              }}>{tab}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
            {blocks.map((block, n) => <ProductCard key={n} block={block} />)}
          </div>
        </div>
      );
    }

    // ── Multicolumn / generic with blocks ──
    const cols = isMobile ? 2 : (section.settings.columns || Math.min(blocks.length, 4));
    const isProductGrid = section.type.includes('collection') || section.type.includes('product') || section.settings.show_price;
    const imgRatio = section.settings.image_ratio === '3:4' ? '133%' : section.settings.image_ratio === '4:3' ? '75%' : section.settings.image_ratio === '16:9' ? '56.25%' : '100%';

    return (
      <div style={{ padding: isMobile ? 16 : 24 }}>
        <SectionHeading heading={sectionHeading} sub={section.settings.subheading} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: isProductGrid ? 12 : 16 }}>
          {isProductGrid
            ? blocks.map((block, n) => <ProductCard key={n} block={block} />)
            : blocks.map((block, n) => (
              <div key={n} style={{ textAlign: section.settings.text_align || 'center' }}>
                {block.has_image && <div style={{ paddingTop: imgRatio, background: `rgba(${fg},0.04)`, borderRadius: css['--card-corner-radius'], marginBottom: 10 }} />}
                {block.heading && <div style={{ fontSize: 13, fontWeight: 600, color: `rgb(${fg})` }}>{block.heading}</div>}
                {block.description && <div style={{ fontSize: 11, color: `rgba(${fg},0.4)`, marginTop: 4, lineHeight: 1.5 }}>{block.description}</div>}
                {block.button_text && (
                  <button style={{ marginTop: 8, padding: '6px 16px', fontSize: 10, fontWeight: 600, background: `rgb(${primary})`, color: `rgb(${bg})`, border: 'none', borderRadius: css['--buttons-radius'] }}>{block.button_text}</button>
                )}
              </div>
            ))
          }
        </div>
        {section.settings.button_text && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, background: `rgb(${primary})`, color: `rgb(${bg})`, border: 'none', borderRadius: css['--buttons-radius'] }}>{section.settings.button_text}</button>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    // If we have extracted blocks, always use the universal renderer
    if (section.settings.blocks && section.settings.blocks.length > 0) {
      return renderBlocks();
    }

    switch (section.type) {
      case 'announcement-bar':
        return (
          <div style={{ height: 40, background: `rgb(${primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: `rgb(${bg})` }}>Free shipping on orders over $50</span>
          </div>
        );

      case 'header':
        return (
          <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: `1px solid rgba(${fg},0.08)` }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})` }}>LOGO</div>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Shop', 'Collections', 'About'].map(t => <span key={t} style={{ fontSize: 12, color: `rgba(${fg},0.6)` }}>{t}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 14, opacity: 0.5 }}>🔍 🛒</div>
          </div>
        );

      case 'hero':
        return (
          <div style={{
            height, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            background: `linear-gradient(135deg, rgba(${primary},0.04), rgba(${css['--color-secondary']},0.06))`,
            padding: isMobile ? 20 : 48,
          }}>
            <div style={{ fontSize: isMobile ? 24 : 40, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: section.settings.text_align || 'center', lineHeight: 1.2 }}>
              {section.settings.heading || 'Hero Headline'}
            </div>
            <div style={{ fontSize: 14, color: `rgba(${fg},0.5)`, marginTop: 12, textAlign: 'center' }}>{section.settings.subheading || 'Subheading text for your brand'}</div>
            <button style={{
              marginTop: 20, padding: '10px 28px', background: `rgb(${primary})`, color: `rgb(${bg})`,
              border: 'none', borderRadius: css['--buttons-radius'], fontSize: 13, fontWeight: 600,
              textTransform: settings.button_text_transform,
            }}>{section.settings.button_text || 'Shop Now'}</button>
          </div>
        );

      case 'trust-badges':
        return (
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'center', gap: isMobile ? 16 : 40, flexWrap: 'wrap' }}>
            {['Free Shipping', '30-Day Returns', 'Secure Payment'].map(b => (
              <div key={b} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>✓</div>
                <div style={{ fontSize: 10, color: `rgba(${fg},0.5)` }}>{b}</div>
              </div>
            ))}
          </div>
        );

      case 'featured-collection':
      case 'featured-products-grid':
      case 'collection-tabs':
      case 'main-collection': {
        const cols = isMobile ? 2 : (section.settings.columns || 4);
        const count = section.settings.products_count || (section.type === 'main-collection' ? 8 : cols);
        const heading = section.settings.heading || section.heading;
        const imgRatio = section.settings.image_ratio || '1:1';
        const paddingTop = imgRatio === '3:4' ? '133%' : imgRatio === '4:3' ? '75%' : imgRatio === '16:9' ? '56.25%' : '100%';
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {section.type !== 'main-collection' && heading && (
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: section.settings.text_align || 'center', marginBottom: 4 }}>
                {heading}
              </div>
            )}
            {section.settings.subheading && (
              <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, textAlign: section.settings.text_align || 'center', marginBottom: 16 }}>
                {section.settings.subheading}
              </div>
            )}
            {section.type === 'collection-tabs' && heading && heading.includes('|') && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                {heading.split('|').map((tab, i) => (
                  <div key={i} style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: i === 0 ? 700 : 400, borderRadius: 4,
                    background: i === 0 ? `rgb(${primary})` : 'transparent',
                    color: i === 0 ? `rgb(${bg})` : `rgba(${fg},0.5)`,
                    border: i === 0 ? 'none' : `1px solid rgba(${fg},0.1)`,
                  }}>{tab.trim()}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
              {Array.from({ length: Math.min(count, cols * 2) }).map((_, n) => {
                const block = section.settings.blocks?.[n];
                return (
                  <div key={n} style={{
                    background: `rgba(${fg},0.03)`, borderRadius: css['--card-corner-radius'],
                    border: settings.card_border_width > 0 ? `${css['--card-border-width']} solid rgba(${fg},0.08)` : 'none',
                    boxShadow: css['--card-shadow'], overflow: 'hidden',
                  }}>
                    <div style={{ paddingTop, background: `rgba(${fg},0.05)` }} />
                    <div style={{ padding: 10 }}>
                      {section.settings.show_vendor && <div style={{ fontSize: 9, color: `rgba(${fg},0.35)`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Brand</div>}
                      <div style={{ fontSize: 12, fontWeight: 500, color: `rgb(${fg})` }}>{block?.heading || `Product ${n + 1}`}</div>
                      {section.settings.show_price !== false && <div style={{ fontSize: 11, color: `rgba(${fg},0.4)`, marginTop: 2 }}>$99.00</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            {section.settings.button_text && section.settings.button_text !== 'Shop Now' && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button style={{
                  padding: '8px 20px', background: section.settings.button_style === 'outline' ? 'transparent' : `rgb(${primary})`,
                  color: section.settings.button_style === 'outline' ? `rgb(${primary})` : `rgb(${bg})`,
                  border: section.settings.button_style === 'outline' ? `1px solid rgb(${primary})` : 'none',
                  borderRadius: css['--buttons-radius'], fontSize: 12, fontWeight: 600,
                }}>{section.settings.button_text}</button>
              </div>
            )}
          </div>
        );
      }

      case 'testimonials':
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: 'center', marginBottom: 16 }}>{section.settings.heading || 'What Customers Say'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${section.settings.columns || 3}, 1fr)`, gap: 12 }}>
              {Array.from({ length: section.settings.columns || 3 }).map((_, n) => (
                <div key={n} style={{ padding: 16, background: `rgba(${fg},0.02)`, borderRadius: css['--card-corner-radius'], border: `1px solid rgba(${fg},0.06)` }}>
                  <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, lineHeight: 1.6 }}>"Great product, highly recommend."</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: `rgb(${fg})`, marginTop: 10 }}>Customer {n + 1}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'newsletter':
        return (
          <div style={{ padding: isMobile ? 20 : 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})` }}>{section.settings.heading || 'Subscribe'}</div>
            {section.settings.subheading && <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, marginTop: 6 }}>{section.settings.subheading}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, width: isMobile ? '100%' : 360 }}>
              <input placeholder="Email" readOnly style={{
                flex: 1, padding: '8px 12px', border: `${css['--inputs-border-width']} solid rgba(${fg},0.15)`,
                borderRadius: css['--inputs-radius'], background: 'transparent', fontSize: 12, color: `rgb(${fg})`,
              }} />
              <button style={{
                padding: '8px 16px', background: `rgb(${primary})`, color: `rgb(${bg})`,
                border: 'none', borderRadius: css['--buttons-radius'], fontSize: 12, fontWeight: 600,
              }}>{section.settings.button_text || 'Subscribe'}</button>
            </div>
          </div>
        );

      case 'footer':
        return (
          <div style={{
            padding: isMobile ? 20 : 32, borderTop: `1px solid rgba(${fg},0.08)`,
            display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 24,
          }}>
            {['Customer Service', 'About', 'Quick Links', 'Newsletter'].map(col => (
              <div key={col}>
                <div style={{ fontSize: 11, fontWeight: 700, color: `rgb(${fg})`, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</div>
                {[1, 2, 3].map(n => <div key={n} style={{ fontSize: 11, color: `rgba(${fg},0.4)`, marginBottom: 6 }}>Link {n}</div>)}
              </div>
            ))}
          </div>
        );

      case 'product-main':
        return (
          <div style={{ padding: isMobile ? 16 : 24, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
            <div style={{ background: `rgba(${fg},0.04)`, borderRadius: css['--card-corner-radius'], paddingTop: '100%' }} />
            <div>
              <div style={{ fontSize: 11, color: `rgba(${fg},0.4)`, textTransform: 'uppercase', letterSpacing: '1px' }}>Brand</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, marginTop: 6 }}>Product Name</div>
              <div style={{ fontSize: 16, color: `rgb(${fg})`, marginTop: 6 }}>$299.00</div>
              <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, marginTop: 12, lineHeight: 1.6 }}>Product description goes here.</div>
              <button style={{
                marginTop: 20, width: '100%', padding: '12px', background: `rgb(${primary})`, color: `rgb(${bg})`,
                border: 'none', borderRadius: css['--buttons-radius'], fontSize: 13, fontWeight: 600,
                textTransform: settings.button_text_transform,
              }}>Add to Cart</button>
            </div>
          </div>
        );

      case 'collection-banner':
        return (
          <div style={{ padding: '32px 24px', background: `rgba(${fg},0.03)` }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})` }}>All Products</div>
            <div style={{ fontSize: 13, color: `rgba(${fg},0.5)`, marginTop: 8 }}>Browse our complete collection</div>
          </div>
        );

      case 'media-with-text':
        return (
          <div style={{ padding: isMobile ? 16 : 32, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24, alignItems: 'center' }}>
            <div style={{ background: `rgba(${fg},0.05)`, borderRadius: css['--card-corner-radius'], paddingTop: '75%', order: section.settings.content_position === 'right' ? 0 : 1 }} />
            <div style={{ order: section.settings.content_position === 'right' ? 1 : 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, lineHeight: 1.2 }}>
                {section.settings.heading || 'Media with Text'}
              </div>
              {section.settings.subheading && <div style={{ fontSize: 13, color: `rgba(${fg},0.5)`, marginTop: 10, lineHeight: 1.6 }}>{section.settings.subheading}</div>}
              {section.settings.button_text && (
                <button style={{
                  marginTop: 16, padding: '8px 20px', background: `rgb(${primary})`, color: `rgb(${bg})`,
                  border: 'none', borderRadius: css['--buttons-radius'], fontSize: 12, fontWeight: 600,
                }}>{section.settings.button_text}</button>
              )}
            </div>
          </div>
        );

      case 'multicolumn': {
        const mcCols = isMobile ? 2 : (section.settings.columns || 3);
        const blocks = section.settings.blocks;
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {section.settings.heading && (
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: section.settings.text_align || 'center', marginBottom: 4 }}>
                {section.settings.heading}
              </div>
            )}
            {section.settings.subheading && (
              <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, textAlign: section.settings.text_align || 'center', marginBottom: 16 }}>
                {section.settings.subheading}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mcCols}, 1fr)`, gap: 16 }}>
              {blocks && blocks.length > 0 ? blocks.map((block, n) => (
                <div key={n} style={{ textAlign: section.settings.text_align || 'center' }}>
                  {block.has_image && <div style={{ background: `rgba(${fg},0.05)`, borderRadius: css['--card-corner-radius'], paddingTop: '80%', marginBottom: 10 }} />}
                  {block.heading && <div style={{ fontSize: 13, fontWeight: 600, color: `rgb(${fg})` }}>{block.heading}</div>}
                  {block.description && <div style={{ fontSize: 11, color: `rgba(${fg},0.4)`, marginTop: 4, lineHeight: 1.5 }}>{block.description}</div>}
                  {block.button_text && (
                    <button style={{
                      marginTop: 8, padding: '5px 14px', fontSize: 10, fontWeight: 600, cursor: 'default',
                      background: `rgb(${primary})`, color: `rgb(${bg})`, border: 'none', borderRadius: css['--buttons-radius'],
                    }}>{block.button_text}</button>
                  )}
                </div>
              )) : Array.from({ length: mcCols }).map((_, n) => (
                <div key={n} style={{ textAlign: section.settings.text_align || 'center' }}>
                  <div style={{ background: `rgba(${fg},0.05)`, borderRadius: css['--card-corner-radius'], paddingTop: '80%', marginBottom: 10 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: `rgb(${fg})` }}>Column {n + 1}</div>
                  <div style={{ fontSize: 11, color: `rgba(${fg},0.4)`, marginTop: 4, lineHeight: 1.5 }}>Description text</div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'rich-text':
        return (
          <div style={{ padding: isMobile ? 20 : 32, textAlign: section.settings.text_align || 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, lineHeight: 1.2 }}>
              {section.settings.heading || 'Rich Text'}
            </div>
            {section.settings.subheading && <div style={{ fontSize: 13, color: `rgba(${fg},0.5)`, marginTop: 10, lineHeight: 1.6 }}>{section.settings.subheading}</div>}
          </div>
        );

      case 'featured-blog':
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: 'center', marginBottom: 16 }}>{section.settings.heading || 'From the Blog'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${section.settings.columns || 3}, 1fr)`, gap: 12 }}>
              {Array.from({ length: section.settings.columns || 3 }).map((_, n) => (
                <div key={n} style={{ borderRadius: css['--card-corner-radius'], overflow: 'hidden', border: `1px solid rgba(${fg},0.06)` }}>
                  <div style={{ paddingTop: '60%', background: `rgba(${fg},0.05)` }} />
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: `rgb(${fg})` }}>Blog Post {n + 1}</div>
                    <div style={{ fontSize: 10, color: `rgba(${fg},0.4)`, marginTop: 4 }}>Apr 1, 2026</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'image-gallery':
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {section.settings.heading && <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: 'center', marginBottom: 16 }}>{section.settings.heading}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : (section.settings.columns || 3)}, 1fr)`, gap: 8 }}>
              {Array.from({ length: section.settings.columns || 6 }).map((_, n) => (
                <div key={n} style={{ paddingTop: section.settings.image_ratio === '16:9' ? '56.25%' : '100%', background: `rgba(${fg},0.05)`, borderRadius: css['--card-corner-radius'] }} />
              ))}
            </div>
          </div>
        );

      case 'logo-list':
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {section.settings.heading && <div style={{ fontSize: 14, fontWeight: 600, color: `rgba(${fg},0.4)`, textAlign: 'center', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>{section.settings.heading}</div>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap', opacity: 0.3 }}>
              {Array.from({ length: 5 }).map((_, n) => (
                <div key={n} style={{ width: 80, height: 40, background: `rgba(${fg},0.08)`, borderRadius: 4 }} />
              ))}
            </div>
          </div>
        );

      case 'video':
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {section.settings.heading && <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: 'center', marginBottom: 16 }}>{section.settings.heading}</div>}
            <div style={{ paddingTop: '56.25%', background: `rgba(${fg},0.05)`, borderRadius: css['--card-corner-radius'], position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: `rgba(${fg},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>▶</div>
              </div>
            </div>
          </div>
        );

      case 'countdown':
        return (
          <div style={{ padding: isMobile ? 16 : 24, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})` }}>{section.settings.heading || 'Sale Ends In'}</div>
            {section.settings.subheading && <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, marginTop: 6 }}>{section.settings.subheading}</div>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
              {['00', '12', '34', '56'].map((v, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: `rgb(${fg})`, fontFamily: 'monospace' }}>{v}</div>
                  <div style={{ fontSize: 9, color: `rgba(${fg},0.4)`, textTransform: 'uppercase' }}>{['Days', 'Hrs', 'Min', 'Sec'][i]}</div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: Math.min(height, 120) }}>
            <span style={{ fontSize: 12, color: `rgba(${fg},0.25)` }}>{template?.label || section.type}</span>
          </div>
        );
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: `rgb(${bg})`,
        fontFamily: css['--font-body-family'],
        transition: 'outline 0.1s',
        outline: isSelected ? '2px solid #6366f1' : hovered ? '2px solid #a5b4fc' : '2px solid transparent',
        outlineOffset: -2,
      }}
    >
      {renderContent()}
      <ResizeHandle />

      {/* Hover toolbar */}
      {hovered && (
        <>
          {/* Section label + controls */}
          <div style={{
            position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, alignItems: 'center',
            background: '#fff', borderRadius: 6, padding: '3px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10,
            border: '1px solid #e5e7eb',
          }}>
            <GripVertical size={12} color="#ccc" style={{ marginRight: 2 }} />
            <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 500, padding: '0 4px' }}>
              {template?.label || section.type}
            </span>
            {onExtractToCanvas && (
              <button onClick={onExtractToCanvas} style={{ ...iconBtnStyle, color: '#f59e0b', fontSize: 10, fontWeight: 600 }} title="Move to canvas">
                ←
              </button>
            )}
            <button onClick={onToggleVisibility} style={iconBtnStyle} title="Hide section">
              <EyeOff size={12} />
            </button>
            <button onClick={onRemove} style={{ ...iconBtnStyle, color: '#ef4444' }} title="Remove section">
              <Trash2 size={12} />
            </button>
          </div>

          {/* Preview tooltip */}
          <div style={{
            position: 'absolute', top: -36, left: '50%', transform: 'translateX(-50%)',
            background: '#1f2937', color: '#f9fafb', fontSize: 10, padding: '5px 10px',
            borderRadius: 6, whiteSpace: 'nowrap', zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
          }}>
            {SECTION_PREVIEWS[section.type] || template?.label || section.type}
            <div style={{
              position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
              width: 8, height: 8, background: '#1f2937',
            }} />
          </div>
        </>
      )}
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
  padding: 2, display: 'flex', alignItems: 'center', borderRadius: 3,
};

export default SectionBlock;

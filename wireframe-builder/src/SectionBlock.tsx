import React, { useState } from 'react';
import { ThemeSettings, ThemeSection, SECTION_TEMPLATES, SECTION_PREVIEWS } from './types';
import { settingsToCSS } from './css-vars';
import { Trash2, EyeOff, GripVertical, RotateCcw, Paintbrush } from 'lucide-react';

interface Props {
  section: ThemeSection;
  settings: ThemeSettings;
  isMobile: boolean;
  onRemove: () => void;
  onToggleVisibility: () => void;
  onExtractToCanvas?: () => void;
  isSelected?: boolean;
}


const SectionBlock: React.FC<Props> = ({ section, settings, isMobile, onRemove, onToggleVisibility, onExtractToCanvas, isSelected }) => {
  const [hovered, setHovered] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const css = settingsToCSS(settings);
  const template = SECTION_TEMPLATES[section.type];
  const height = section.height || template?.defaultHeight || 200;
  const fg = css['--color-foreground'];
  const primary = css['--color-primary'];
  const bg = css['--color-background'];

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
        }}
      >
        <iframe
          src={`http://localhost:3007/extracted/${section.importedHtml}`}
          style={{
            width: '100%', height: height, border: 'none',
            pointerEvents: 'none',
          }}
          title={section.type}
        />
        {hovered && (
          <div style={{
            position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, alignItems: 'center',
            background: '#fff', borderRadius: 6, padding: '3px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10, border: '1px solid #e5e7eb',
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

  const renderContent = () => {
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
            <div style={{ fontSize: isMobile ? 24 : 40, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: 'center', lineHeight: 1.2 }}>
              Hero Headline
            </div>
            <div style={{ fontSize: 14, color: `rgba(${fg},0.5)`, marginTop: 12, textAlign: 'center' }}>Subheading text for your brand</div>
            <button style={{
              marginTop: 20, padding: '10px 28px', background: `rgb(${primary})`, color: `rgb(${bg})`,
              border: 'none', borderRadius: css['--buttons-radius'], fontSize: 13, fontWeight: 600,
              textTransform: settings.button_text_transform,
            }}>Shop Now</button>
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
        const cols = isMobile ? 2 : 4;
        const count = section.type === 'main-collection' ? 8 : 4;
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {section.type !== 'main-collection' && (
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: 'center', marginBottom: 16 }}>
                Featured Collection
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
              {Array.from({ length: count }).map((_, n) => (
                <div key={n} style={{
                  background: `rgba(${fg},0.03)`, borderRadius: css['--card-corner-radius'],
                  border: settings.card_border_width > 0 ? `${css['--card-border-width']} solid rgba(${fg},0.08)` : 'none',
                  boxShadow: css['--card-shadow'], overflow: 'hidden',
                }}>
                  <div style={{ paddingTop: '100%', background: `rgba(${fg},0.05)` }} />
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: `rgb(${fg})` }}>Product {n + 1}</div>
                    <div style={{ fontSize: 11, color: `rgba(${fg},0.4)`, marginTop: 2 }}>$99.00</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'testimonials':
        return (
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})`, textAlign: 'center', marginBottom: 16 }}>What Customers Say</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ padding: 16, background: `rgba(${fg},0.02)`, borderRadius: css['--card-corner-radius'], border: `1px solid rgba(${fg},0.06)` }}>
                  <div style={{ fontSize: 12, color: `rgba(${fg},0.5)`, lineHeight: 1.6 }}>"Great product, highly recommend."</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: `rgb(${fg})`, marginTop: 10 }}>Customer {n}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'newsletter':
        return (
          <div style={{ padding: isMobile ? 20 : 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: css['--font-heading-family'], color: `rgb(${fg})` }}>Subscribe</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, width: isMobile ? '100%' : 360 }}>
              <input placeholder="Email" readOnly style={{
                flex: 1, padding: '8px 12px', border: `${css['--inputs-border-width']} solid rgba(${fg},0.15)`,
                borderRadius: css['--inputs-radius'], background: 'transparent', fontSize: 12, color: `rgb(${fg})`,
              }} />
              <button style={{
                padding: '8px 16px', background: `rgb(${primary})`, color: `rgb(${bg})`,
                border: 'none', borderRadius: css['--buttons-radius'], fontSize: 12, fontWeight: 600,
              }}>Subscribe</button>
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
            {onExtractToCanvas && section.importedHtml && (
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

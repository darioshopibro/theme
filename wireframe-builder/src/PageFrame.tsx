import React, { useState, useRef } from 'react';
import { ThemeSettings, ThemeSection, PageType, SectionSettings, SECTION_TEMPLATES, DEFAULT_SECTION_SETTINGS } from './types';
import { Eye, Smartphone, Monitor, CircleAlert } from 'lucide-react';
import SectionBlock from './SectionBlock';
import SectionSettingsPopup from './SectionSettingsPopup';

interface Props {
  pageType: PageType;
  label: string;
  sections: ThemeSection[];
  settings: ThemeSettings;
  onSectionsChange: (sections: ThemeSection[]) => void;
  onPreview: (page: PageType, mobile: boolean) => void;
  onExtractSection: (section: ThemeSection) => void;
  x: number;
  y: number;
}

const PageFrame: React.FC<Props> = ({ pageType, label, sections, settings, onSectionsChange, onPreview, onExtractSection, x, y }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [popupY, setPopupY] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Smooth reorder state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const width = isMobile ? 375 : settings.page_width;
  const visibleSections = sections.filter(s => s.visible);

  const addSection = (type: string) => {
    const template = SECTION_TEMPLATES[type];
    onSectionsChange([...sections, {
      id: `${pageType}-${type}-${Date.now()}`,
      type, heading: null, visible: true,
      order: sections.length,
      height: template?.defaultHeight || 200,
      settings: { ...DEFAULT_SECTION_SETTINGS },
    }]);
    setShowAddMenu(false);
  };

  const removeSection = (id: string) => {
    if (selectedSection === id) setSelectedSection(null);
    onSectionsChange(sections.filter(s => s.id !== id));
  };

  const toggleVisibility = (id: string) => {
    onSectionsChange(sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  const updateSectionSettings = (id: string, newSettings: SectionSettings) => {
    onSectionsChange(sections.map(s => s.id === id ? { ...s, settings: newSettings } : s));
  };

  const onSectionClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedSection === id) {
      setSelectedSection(null);
      return;
    }
    setSelectedSection(id);
    // Get section's Y position within the frame
    const sectionEl = sectionRefs.current[id];
    if (sectionEl) {
      setPopupY(sectionEl.offsetTop);
    }
  };

  // Smooth drag handlers
  const handleDragStart = (id: string) => setDragId(id);

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(targetIdx);
  };

  const handleDrop = (targetIdx: number) => {
    if (!dragId) return;
    const fromIdx = sections.findIndex(s => s.id === dragId);
    if (fromIdx < 0 || fromIdx === targetIdx) { setDragId(null); setDropTarget(null); return; }
    const list = [...sections];
    const [moved] = list.splice(fromIdx, 1);
    list.splice(targetIdx, 0, moved);
    onSectionsChange(list.map((s, i) => ({ ...s, order: i })));
    setDragId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => { setDragId(null); setDropTarget(null); };

  const [showChecklist, setShowChecklist] = useState(false);

  const availableSections = Object.entries(SECTION_TEMPLATES).filter(([_, t]) => t.pages.includes(pageType));
  const selectedSectionData = selectedSection ? sections.find(s => s.id === selectedSection) : null;

  // Progress calculation
  const progress = calcProgress(pageType, sections, settings);

  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      {/* Frame header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{label}</span>
          <span style={{ fontSize: 10, color: '#bbb', fontFamily: 'monospace' }}>{width}px</span>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <IconBtn title={isMobile ? 'Desktop' : 'Mobile'} onClick={() => setIsMobile(!isMobile)} active={isMobile}>
            {isMobile ? <Smartphone size={13} /> : <Monitor size={13} />}
          </IconBtn>
          <IconBtn title="Preview" onClick={() => onPreview(pageType, isMobile)}>
            <Eye size={13} />
          </IconBtn>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 6, position: 'relative' }}>
        <div
          onClick={() => setShowChecklist(!showChecklist)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', padding: '4px 0',
          }}
        >
          <div style={{
            flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, transition: 'width 0.3s ease',
              width: `${progress.percent}%`,
              background: progress.percent === 100 ? '#22c55e' : progress.percent > 60 ? '#6366f1' : progress.percent > 30 ? '#f59e0b' : '#ef4444',
            }} />
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, fontFamily: 'monospace', minWidth: 32,
            color: progress.percent === 100 ? '#22c55e' : '#9ca3af',
          }}>
            {progress.percent}%
          </span>
          <CircleAlert size={12} color={progress.missing.length > 0 ? '#f59e0b' : '#22c55e'} />
        </div>

        {/* Checklist popup */}
        {showChecklist && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowChecklist(false)} />
            <div style={{
              position: 'absolute', top: 28, left: 0, width: 280,
              background: '#fff', borderRadius: 10, zIndex: 9999,
              boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Checklist — {label}</span>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{progress.done}/{progress.total}</span>
              </div>
              <div style={{ padding: '8px 14px', maxHeight: 300, overflowY: 'auto' }}>
                {progress.items.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                    borderBottom: i < progress.items.length - 1 ? '1px solid #f9fafb' : 'none',
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: item.done ? 'none' : '1.5px solid #d1d5db',
                      background: item.done ? '#22c55e' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff',
                    }}>
                      {item.done && '✓'}
                    </div>
                    <span style={{
                      fontSize: 11, color: item.done ? '#9ca3af' : '#374151',
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Frame body */}
      <div ref={frameRef} style={{
        width, minHeight: 400, background: '#fff', borderRadius: 4,
        boxShadow: '0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
        overflow: 'hidden', position: 'relative', transition: 'width 0.3s ease',
      }}>
        {visibleSections.map((section) => {
          const realIdx = sections.indexOf(section);
          const isDragging = dragId === section.id;
          const isDropTarget = dropTarget === realIdx;
          const isSelected = selectedSection === section.id;

          return (
            <div
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el; }}
              draggable
              onDragStart={() => handleDragStart(section.id)}
              onDragOver={(e) => handleDragOver(e, realIdx)}
              onDrop={() => handleDrop(realIdx)}
              onDragEnd={handleDragEnd}
              onClick={(e) => onSectionClick(section.id, e)}
              style={{
                position: 'relative',
                opacity: isDragging ? 0.3 : 1,
                transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                transition: 'all 0.2s ease',
                cursor: 'grab',
              }}
            >
              {/* Drop indicator line */}
              {isDropTarget && !isDragging && (
                <div style={{
                  position: 'absolute', top: -2, left: 8, right: 8, height: 3,
                  background: '#6366f1', borderRadius: 2, zIndex: 5,
                  boxShadow: '0 0 8px rgba(99,102,241,0.4)',
                }} />
              )}
              <SectionBlock
                section={section}
                settings={settings}
                isMobile={isMobile}
                onRemove={() => removeSection(section.id)}
                onToggleVisibility={() => toggleVisibility(section.id)}
                onExtractToCanvas={() => { onExtractSection(section); removeSection(section.id); }}
                isSelected={isSelected}
              />
            </div>
          );
        })}

        {/* Add section */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{
              width: '100%', padding: 14, background: showAddMenu ? '#f5f3ff' : '#fafafa',
              border: '2px dashed ' + (showAddMenu ? '#6366f1' : '#e5e7eb'), borderRadius: 0,
              color: showAddMenu ? '#6366f1' : '#9ca3af', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!showAddMenu) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; } }}
            onMouseLeave={e => { if (!showAddMenu) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#9ca3af'; } }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add section
          </button>

          {showAddMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowAddMenu(false)} />
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280,
                overflowY: 'auto', zIndex: 100, marginBottom: 4,
              }}>
                {availableSections.map(([type, t]) => (
                  <button key={type} onClick={() => addSection(type)} style={{
                    width: '100%', padding: '8px 14px', background: 'none',
                    border: 'none', textAlign: 'left', cursor: 'pointer',
                    fontSize: 12, color: '#374151', display: 'block',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Section settings popup — positioned right of frame, at section Y */}
      {selectedSectionData && (
        <div style={{
          position: 'absolute',
          left: width + 16,
          top: popupY,
          zIndex: 9999,
        }}>
          <SectionSettingsPopup
            section={selectedSectionData}
            onChange={(s) => updateSectionSettings(selectedSectionData.id, s)}
            onClose={() => setSelectedSection(null)}
          />
        </div>
      )}
    </div>
  );
};

// Progress checker
interface CheckItem { label: string; done: boolean }
interface ProgressResult { percent: number; done: number; total: number; items: CheckItem[]; missing: string[] }

const REQUIRED_SECTIONS: Record<PageType, string[]> = {
  homepage: ['header', 'hero', 'featured-collection', 'footer'],
  collection: ['header', 'breadcrumb', 'main-collection', 'footer'],
  product: ['header', 'breadcrumb', 'product-main', 'footer'],
};

const RECOMMENDED_SECTIONS: Record<PageType, string[]> = {
  homepage: ['announcement-bar', 'trust-badges', 'testimonials', 'newsletter', 'featured-blog'],
  collection: ['collection-banner', 'rich-text', 'newsletter'],
  product: ['product-description', 'related-products', 'recently-viewed', 'newsletter'],
};

function calcProgress(pageType: PageType, sections: ThemeSection[], settings: ThemeSettings): ProgressResult {
  const items: CheckItem[] = [];
  const sectionTypes = sections.filter(s => s.visible).map(s => s.type);

  // Required sections
  for (const type of REQUIRED_SECTIONS[pageType]) {
    const tmpl = SECTION_TEMPLATES[type];
    items.push({ label: `${tmpl?.label || type} (required)`, done: sectionTypes.includes(type) });
  }

  // Recommended sections
  for (const type of RECOMMENDED_SECTIONS[pageType]) {
    const tmpl = SECTION_TEMPLATES[type];
    items.push({ label: `${tmpl?.label || type}`, done: sectionTypes.includes(type) });
  }

  // Settings checks
  items.push({ label: 'Primary color set', done: settings.color_primary !== '#121212' || settings.color_primary === '#121212' }); // placeholder — always done for now
  items.push({ label: 'Heading font chosen', done: settings.font_heading !== 'Playfair Display' });
  items.push({ label: 'Body font chosen', done: settings.font_body !== 'Inter' });
  items.push({ label: 'Button radius decided', done: true }); // placeholder
  items.push({ label: 'Card style decided', done: settings.card_radius > 0 || settings.card_shadow_opacity > 0 || settings.card_border_width > 0 });

  // Section settings checks (at least heading filled for key sections)
  const keySections = sections.filter(s => s.visible && ['hero', 'featured-collection', 'testimonials', 'newsletter'].includes(s.type));
  for (const s of keySections) {
    const tmpl = SECTION_TEMPLATES[s.type];
    items.push({
      label: `${tmpl?.label || s.type} — heading set`,
      done: !!(s.settings?.heading && s.settings.heading.length > 0),
    });
  }

  const done = items.filter(i => i.done).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const missing = items.filter(i => !i.done).map(i => i.label);

  return { percent, done, total, items, missing };
}

const IconBtn: React.FC<{ children: React.ReactNode; onClick: () => void; title?: string; active?: boolean }> = ({ children, onClick, title, active }) => (
  <button title={title} onClick={onClick} style={{
    background: active ? '#eef2ff' : '#fff', border: '1px solid ' + (active ? '#6366f1' : '#d1d5db'),
    borderRadius: 5, cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center',
    color: active ? '#6366f1' : '#9ca3af', transition: 'all 0.15s',
  }}>
    {children}
  </button>
);

export default PageFrame;

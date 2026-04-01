import React, { useState, useEffect } from 'react';
import { ThemeSettings, ThemeSection, PageType, ImportedBlock, DEFAULT_SETTINGS, SECTION_TEMPLATES, DEFAULT_SECTION_SETTINGS } from './types';
import { getFontImportUrl, settingsToCSS } from './css-vars';
import SettingsSidebar from './SettingsSidebar';
import Canvas from './Canvas';
import PageFrame from './PageFrame';
import SectionBlock from './SectionBlock';
import ImportModal from './ImportModal';

function getDefaultSections(pageType: PageType): ThemeSection[] {
  return Object.entries(SECTION_TEMPLATES)
    .filter(([_, t]) => t.pages.includes(pageType))
    .map(([type, t], i) => ({
      id: `${pageType}-${type}-${i}`,
      type, heading: null, visible: true, order: i, height: t.defaultHeight,
      settings: { ...DEFAULT_SECTION_SETTINGS },
    }));
}

const App: React.FC = () => {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [sections, setSections] = useState<Record<PageType, ThemeSection[]>>({
    homepage: getDefaultSections('homepage'),
    collection: getDefaultSections('collection'),
    product: getDefaultSections('product'),
  });
  const [preview, setPreview] = useState<{ page: PageType; mobile: boolean; width: number } | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    const link = document.getElementById('gf') as HTMLLinkElement || document.createElement('link');
    link.id = 'gf'; link.rel = 'stylesheet';
    link.href = getFontImportUrl([settings.font_heading, settings.font_body]);
    if (!document.getElementById('gf')) document.head.appendChild(link);
  }, [settings.font_heading, settings.font_body]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const updateSections = (page: PageType, s: ThemeSection[]) => setSections(prev => ({ ...prev, [page]: s }));

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify({ settings, sections }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'theme-config.json'; a.click();
  };

  // Imported sections on canvas (not in any page yet)
  const [canvasSections, setCanvasSections] = useState<ThemeSection[]>([]);

  const handleImport = (file: string, sectionId: string, blocks: { tag: string; html: string; text: string; height: number }[]) => {
    const sectionType = sectionId.split('__').pop()?.replace(/_[A-Za-z0-9]+$/, '') || 'imported';
    const importedBlocks: ImportedBlock[] = blocks.map((b, i) => ({
      id: `block-${Date.now()}-${i}`,
      tag: b.tag,
      html: b.html,
      text: b.text,
      height: b.height,
      visible: true,
    }));
    const newSection: ThemeSection = {
      id: `imported-${Date.now()}`,
      type: sectionType,
      heading: `Imported: ${sectionType}`,
      visible: true,
      order: 999,
      height: Math.max(300, blocks.reduce((a, b) => a + b.height, 0)),
      settings: { ...DEFAULT_SECTION_SETTINGS },
      importedHtml: file,
      importedBlocks: importedBlocks,
    };
    setCanvasSections(prev => [...prev, newSection]);
  };

  // Imported full pages on canvas
  const [canvasPages, setCanvasPages] = useState<{ id: string; file: string; name: string; x: number; y: number }[]>([]);

  const handleImportPage = (file: string, pageName: string) => {
    setCanvasPages(prev => [...prev, {
      id: `page-${Date.now()}`,
      file,
      name: pageName,
      x: (settings.page_width + 100) * 3 + 100,
      y: prev.length * 900,
    }]);
  };

  // When user clicks a section in imported page → extract it via server and add to canvas
  const handleSectionPick = async (sectionId: string, sectionType: string, height: number, sourceFile: string) => {
    try {
      // Call server to extract this section from the full page file
      const url = sourceFile.includes('_full.html')
        ? `http://localhost:3007/extracted/${sourceFile}`.replace('/extracted/extracted/', '/extracted/')
        : '';

      const res = await fetch('http://localhost:3007/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoUrl: 'file://' + sourceFile, // won't be used for URL, just for naming
          sectionMatch: sectionType,
        }),
      });

      // For now, create section pointing to source file with section type
      // The iframe will show the full page but we track which section was picked
      const newSection: ThemeSection = {
        id: `picked-${Date.now()}`,
        type: sectionType,
        heading: `Picked: ${sectionType}`,
        visible: true,
        order: 999,
        height: height || 500,
        settings: { ...DEFAULT_SECTION_SETTINGS },
        importedHtml: sourceFile,
      };
      setCanvasSections(prev => [...prev, newSection]);
    } catch (e) {
      console.error('Section pick failed:', e);
    }
  };

  const removeCanvasPage = (id: string) => {
    setCanvasPages(prev => prev.filter(p => p.id !== id));
  };

  const removeCanvasSection = (id: string) => {
    setCanvasSections(prev => prev.filter(s => s.id !== id));
  };

  const updateCanvasSection = (id: string, updated: ThemeSection) => {
    setCanvasSections(prev => prev.map(s => s.id === id ? updated : s));
  };

  // Preview mode
  if (preview) {
    const css = settingsToCSS(settings);
    const previewSections = sections[preview.page].filter(s => s.visible);
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#111', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 20px', background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #27272a' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['homepage', 'collection', 'product'] as PageType[]).map(pt => (
              <button key={pt} onClick={() => setPreview({ ...preview, page: pt })} style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: preview.page === pt ? '#6366f1' : '#27272a', color: preview.page === pt ? '#fff' : '#a1a1aa',
                transition: 'all 0.15s',
              }}>
                {pt === 'homepage' ? 'Home' : pt === 'collection' ? 'Collection' : 'Product'}
              </button>
            ))}
          </div>

          {/* Width slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 400, margin: '0 24px' }}>
            <span style={{ fontSize: 10, color: '#71717a' }}>📱</span>
            <input
              type="range" min={300} max={2400} step={10}
              value={preview.width}
              onChange={e => setPreview({ ...preview, width: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#6366f1' }}
            />
            <span style={{ fontSize: 10, color: '#71717a' }}>🖥</span>
            <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', minWidth: 48 }}>{preview.width}px</span>
          </div>

          <button onClick={() => setPreview(null)} style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid #3f3f46',
            background: '#27272a', color: '#d4d4d8', fontSize: 12, cursor: 'pointer', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 10, background: '#3f3f46', padding: '1px 5px', borderRadius: 3, color: '#a1a1aa' }}>Esc</span>
            Close
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', background: '#09090b', padding: '0' }}>
          <div style={{ width: preview.width, background: `rgb(${css['--color-background']})`, minHeight: '100%', transition: 'width 0.2s ease' }}>
            {previewSections.map(section => (
              <SectionBlock key={section.id} section={section} settings={settings} isMobile={preview.width < 768} onRemove={() => {}} onToggleVisibility={() => {}} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SettingsSidebar settings={settings} onChange={setSettings} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '6px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Theme Wireframe
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowImport(true)} style={{
              padding: '4px 14px', borderRadius: 6, border: '1px solid #6366f1', background: '#eef2ff',
              color: '#6366f1', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}>Import Page</button>
            <button onClick={exportConfig} style={{
              padding: '4px 14px', borderRadius: 6, border: 'none', background: '#6366f1',
              color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}>Export JSON</button>
          </div>
        </div>

        <Canvas>
          <PageFrame
            pageType="homepage" label="Homepage"
            sections={sections.homepage} settings={settings}
            onSectionsChange={s => updateSections('homepage', s)}
            onPreview={(p, m) => setPreview({ page: p, mobile: m, width: m ? 375 : settings.page_width })}

            x={0} y={0}
          />
          <PageFrame
            pageType="collection" label="Collection"
            sections={sections.collection} settings={settings}
            onSectionsChange={s => updateSections('collection', s)}
            onPreview={(p, m) => setPreview({ page: p, mobile: m, width: m ? 375 : settings.page_width })}

            x={settings.page_width + 100} y={0}
          />
          <PageFrame
            pageType="product" label="Product"
            sections={sections.product} settings={settings}
            onSectionsChange={s => updateSections('product', s)}
            onPreview={(p, m) => setPreview({ page: p, mobile: m, width: m ? 375 : settings.page_width })}

            x={(settings.page_width + 100) * 2} y={0}
          />

          {/* Imported full pages — far right */}
          {canvasPages.map((pg) => (
            <ImportedPageCard
              key={pg.id}
              file={pg.file}
              name={pg.name}
              initialX={pg.x}
              initialY={pg.y}
              onRemove={() => removeCanvasPage(pg.id)}
              onSectionPick={handleSectionPick}
            />
          ))}

          {/* Picked/imported sections — below all page frames, spaced out */}
          {canvasSections.map((sec, i) => (
            <ImportedSectionCard
              key={sec.id}
              section={sec}
              initialX={i * 1550}
              initialY={-800}
              onRemove={() => removeCanvasSection(sec.id)}
              onUpdate={(updated) => updateCanvasSection(sec.id, updated)}
            />
          ))}
        </Canvas>

        {showImport && (
          <ImportModal
            onImport={handleImport}
            onImportPage={handleImportPage}
            onClose={() => setShowImport(false)}
          />
        )}
      </div>
    </div>
  );
};

// Imported section card on canvas — draggable + iframe with edit overlay
const ImportedSectionCard: React.FC<{
  section: ThemeSection;
  initialX: number;
  initialY: number;
  onRemove: () => void;
  onUpdate: (s: ThemeSection) => void;
}> = ({ section, initialX, initialY, onRemove, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(section.height || 600);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (editing) return; // don't drag in edit mode
    if ((e.target as HTMLElement).closest('button')) return; // don't drag from buttons
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    e.preventDefault();
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, dragStart]);

  // Auto-detect iframe content height
  const onIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const h = doc.body.scrollHeight;
        if (h > 50) setIframeHeight(h);
      }
    } catch (e) {}
  };

  // Toggle edit mode via postMessage to iframe
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => {
      iframe.contentWindow?.postMessage(editing ? 'EDIT_ON' : 'EDIT_OFF', '*');
    };
    // Send after short delay to ensure iframe is loaded
    const t = setTimeout(send, 300);
    return () => clearTimeout(t);
  }, [editing]);

  // Listen for height updates from iframe
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'IFRAME_HEIGHT') {
        setIframeHeight(e.data.height);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div
      style={{
        position: 'absolute', left: pos.x, top: pos.y,
        cursor: dragging ? 'grabbing' : editing ? 'default' : 'grab',
        opacity: dragging ? 0.85 : 1,
        transition: dragging ? 'none' : 'opacity 0.15s',
      }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#f59e0b' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>Imported: {section.type}</span>
          <span style={{ fontSize: 9, color: '#d97706', fontStyle: 'italic' }}>drag to move</span>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <button
            onClick={() => setEditing(!editing)}
            style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (editing ? '#6366f1' : '#d1d5db'),
              background: editing ? '#eef2ff' : '#fff',
              color: editing ? '#6366f1' : '#6b7280',
            }}
          >
            {editing ? '✓ Done' : 'Edit Blocks'}
          </button>
          <button onClick={onRemove} style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
            border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444',
          }}>Remove</button>
        </div>
      </div>

      {/* Section — always iframe, edit mode via injection */}
      <div style={{
        width: 1440, background: '#fff', borderRadius: 6,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08), 0 0 0 2px ' + (editing ? '#6366f140' : '#f59e0b40'),
        overflow: 'hidden',
      }}>
        <iframe
          ref={iframeRef}
          src={`http://localhost:3007/extracted/${section.importedHtml}`}
          style={{
            width: '100%',
            height: iframeHeight,
            border: 'none',
            pointerEvents: editing ? 'auto' : 'none',
            display: 'block',
          }}
          title={section.type}
          onLoad={onIframeLoad}
        />
      </div>
    </div>
  );
};

// Imported full page card on canvas — click sections to extract
const ImportedPageCard: React.FC<{
  file: string;
  name: string;
  initialX: number;
  initialY: number;
  onRemove: () => void;
  onSectionPick: (sectionId: string, sectionType: string, height: number, sourceFile: string) => void;
}> = ({ file, name, initialX, initialY, onRemove, onSectionPick }) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [iframeHeight, setIframeHeight] = useState(3000);
  const [picking, setPicking] = useState(true);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('iframe')) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    e.preventDefault();
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, dragStart]);

  // Listen for section picks from iframe
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'SECTION_PICKED') {
        onSectionPick(e.data.sectionId, e.data.sectionType, e.data.height, file);
      }
      if (e.data?.type === 'IFRAME_HEIGHT' && e.data.height > 100) {
        setIframeHeight(e.data.height);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [file, onSectionPick]);

  return (
    <div
      style={{ position: 'absolute', left: pos.x, top: pos.y, cursor: dragging ? 'grabbing' : 'default', opacity: dragging ? 0.85 : 1 }}
      onMouseDown={onMouseDown}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Imported: {name}</span>
          <span style={{ fontSize: 10, color: picking ? '#22c55e' : '#9ca3af', fontWeight: 500 }}>
            {picking ? '← click sections to extract' : 'drag header to move'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={() => setPicking(!picking)} style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
            border: '1px solid ' + (picking ? '#22c55e' : '#d1d5db'),
            background: picking ? '#f0fdf4' : '#fff',
            color: picking ? '#22c55e' : '#6b7280',
          }}>
            {picking ? 'Picking ON' : 'Picking OFF'}
          </button>
          <button onClick={onRemove} style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
            border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444',
          }}>Remove</button>
        </div>
      </div>
      <div style={{
        width: 1440, background: '#fff', borderRadius: 6,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08), 0 0 0 2px rgba(34,197,94,0.3)',
        overflow: 'hidden',
      }}>
        <iframe
          src={`http://localhost:3007/extracted/${file}`}
          style={{ width: '100%', height: iframeHeight, border: 'none', pointerEvents: picking ? 'auto' : 'none', display: 'block' }}
          title={name}
        />
      </div>
    </div>
  );
};

export default App;

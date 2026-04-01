import React, { useState } from 'react';
import { X, Loader, Download, Home, ShoppingBag, Package } from 'lucide-react';

const API = 'http://localhost:3007';

interface SectionRect {
  id: string;
  type: string;
  heading: string | null;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ImportedBlock {
  tag: string;
  html: string;
  text: string;
  height: number;
}

interface Props {
  onImport: (file: string, sectionId: string, blocks: ImportedBlock[]) => void;
  onImportPage: (file: string, pageName: string) => void;
  onClose: () => void;
}

type PageTab = 'home' | 'collection' | 'product';

const ImportModal: React.FC<Props> = ({ onImport, onImportPage, onClose }) => {
  const [step, setStep] = useState<'url' | 'browse' | 'fullpage' | 'extracting' | 'done'>('url');
  const [demoUrl, setDemoUrl] = useState('');
  const [pageTab, setPageTab] = useState<PageTab>('home');
  const [screenshot, setScreenshot] = useState('');
  const [sections, setSections] = useState<SectionRect[]>([]);
  const [pageWidth, setPageWidth] = useState(1440);
  const [pageHeight, setPageHeight] = useState(900);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ file: string; sectionId: string; blocks: ImportedBlock[] } | null>(null);
  const [fullPageFile, setFullPageFile] = useState<string | null>(null);
  const [fullPageSections, setFullPageSections] = useState<SectionRect[]>([]);

  const baseUrl = demoUrl.replace(/\/$/, '');

  // Import full page and show in iframe
  const importFullPage = async (tab: PageTab) => {
    setPageTab(tab);
    setLoading(true);
    setError('');

    let url = baseUrl;
    if (tab === 'collection') url = baseUrl + '/collections/all';
    if (tab === 'product') url = baseUrl + '/collections/all';

    try {
      const res = await fetch(`${API}/api/import-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setFullPageFile(data.file);
      setFullPageSections(data.sections.map((s: any) => ({ ...s, left: 0, width: 1440 })));
      setStep('fullpage');
    } catch (e: any) {
      setError('Server error');
    }
    setLoading(false);
  };

  const loadPage = async (tab: PageTab) => {
    setPageTab(tab);
    setLoading(true);
    setError('');

    let url = baseUrl;
    if (tab === 'collection') url = baseUrl + '/collections/all';
    if (tab === 'product') url = baseUrl + '/collections/all'; // will find product from there

    try {
      const res = await fetch(`${API}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setScreenshot(data.screenshot);
      setSections(data.sections);
      setPageWidth(data.pageWidth);
      setPageHeight(data.pageHeight);
      setStep('browse');
    } catch (e: any) {
      setError('Server not running. Run: npm run dev');
    }
    setLoading(false);
  };

  const extractSection = async (sectionType: string) => {
    setStep('extracting');
    setError('');

    let url = baseUrl;
    if (pageTab === 'collection') url = baseUrl + '/collections/all';

    try {
      const res = await fetch(`${API}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoUrl: url, sectionMatch: sectionType }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStep('browse'); return; }
      setResult({ file: data.file, sectionId: data.sectionId, blocks: data.blocks || [] });
      setStep('done');
    } catch (e: any) {
      setError(e.message);
      setStep('browse');
    }
  };

  // Scale factor for displaying screenshot
  const containerWidth = 900;
  const scale = containerWidth / pageWidth;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={16} color="#6366f1" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
              {step === 'url' ? 'Import Section' : step === 'browse' ? 'Click a section to import' : step === 'extracting' ? 'Extracting...' : 'Done!'}
            </span>
          </div>
          <button onClick={onClose} style={s.closeBtn}><X size={16} /></button>
        </div>

        {/* Step: URL */}
        {step === 'url' && !loading && (
          <div style={s.body}>
            <label style={s.label}>Store URL</label>
            <input
              value={demoUrl}
              onChange={e => setDemoUrl(e.target.value)}
              placeholder="https://store-name.myshopify.com"
              style={s.input}
              onKeyDown={e => e.key === 'Enter' && loadPage('home')}
              autoFocus
            />
            <p style={s.hint}>Works with Shopify demos and most websites</p>
            {error && <p style={s.error}>{error}</p>}

            {/* Two modes */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Import Section</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { tab: 'home' as PageTab, icon: <Home size={14} />, label: 'Homepage' },
                  { tab: 'collection' as PageTab, icon: <ShoppingBag size={14} />, label: 'Collection' },
                  { tab: 'product' as PageTab, icon: <Package size={14} />, label: 'Product' },
                ]).map(({ tab, icon, label }) => (
                  <button key={tab} onClick={() => loadPage(tab)} disabled={!demoUrl}
                    style={{ ...s.pageBtn, opacity: !demoUrl ? 0.4 : 1 }}>
                    {icon}<span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Import Full Page</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { tab: 'home' as PageTab, icon: <Home size={14} />, label: 'Homepage' },
                  { tab: 'collection' as PageTab, icon: <ShoppingBag size={14} />, label: 'Collection' },
                  { tab: 'product' as PageTab, icon: <Package size={14} />, label: 'Product' },
                ]).map(({ tab, icon, label }) => (
                  <button key={`full-${tab}`} onClick={() => importFullPage(tab)} disabled={!demoUrl}
                    style={{ ...s.pageBtn, opacity: !demoUrl ? 0.4 : 1, borderColor: '#22c55e40' }}>
                    {icon}<span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ ...s.body, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60 }}>
            <Loader size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 16 }}>Loading...</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>This takes ~10-15 seconds</p>
          </div>
        )}

        {/* Step: Browse screenshot */}
        {step === 'browse' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Page tabs */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { tab: 'home' as PageTab, icon: <Home size={12} />, label: 'Home' },
                  { tab: 'collection' as PageTab, icon: <ShoppingBag size={12} />, label: 'Collection' },
                  { tab: 'product' as PageTab, icon: <Package size={12} />, label: 'Product' },
                ]).map(({ tab, icon, label }) => (
                  <button key={tab} onClick={() => loadPage(tab)} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid ' + (pageTab === tab ? '#6366f1' : '#e5e7eb'),
                    background: pageTab === tab ? '#eef2ff' : '#fff', color: pageTab === tab ? '#6366f1' : '#6b7280',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {icon} {label}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{sections.length} sections detected</span>
            </div>

            {/* Screenshot with overlay */}
            <div style={{ flex: 1, overflow: 'auto', background: '#f9fafb', display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <div style={{ position: 'relative', width: containerWidth, height: pageHeight * scale }}>
                <img src={screenshot} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />

                {/* Section overlays */}
                {sections.map(sec => (
                  <div
                    key={sec.id}
                    onMouseEnter={() => setHoveredSection(sec.id)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => extractSection(sec.type)}
                    style={{
                      position: 'absolute',
                      top: sec.top * scale,
                      left: sec.left * scale,
                      width: sec.width * scale,
                      height: sec.height * scale,
                      border: hoveredSection === sec.id ? '2px solid #6366f1' : '1px solid transparent',
                      background: hoveredSection === sec.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                      borderRadius: 4,
                    }}
                  >
                    {hoveredSection === sec.id && (
                      <div style={{
                        position: 'absolute', top: 4, left: 4,
                        background: '#6366f1', color: '#fff', padding: '3px 8px',
                        borderRadius: 4, fontSize: 10, fontWeight: 600,
                        whiteSpace: 'nowrap', zIndex: 5,
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                      }}>
                        {sec.type} {sec.heading ? `— ${sec.heading}` : ''} • Click to import
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#ef4444', fontSize: 11, flexShrink: 0 }}>{error}</div>}
          </div>
        )}

        {/* Step: Full page imported — preview + add to canvas */}
        {step === 'fullpage' && !loading && fullPageFile && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#22c55e' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  Full page imported — {fullPageSections.length} sections detected
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { tab: 'home' as PageTab, label: 'Home' },
                  { tab: 'collection' as PageTab, label: 'Collection' },
                  { tab: 'product' as PageTab, label: 'Product' },
                ]).map(({ tab, label }) => (
                  <button key={tab} onClick={() => importFullPage(tab)} style={{
                    padding: '4px 10px', borderRadius: 5, border: '1px solid ' + (pageTab === tab ? '#6366f1' : '#e5e7eb'),
                    background: pageTab === tab ? '#eef2ff' : '#fff', color: pageTab === tab ? '#6366f1' : '#9ca3af',
                    fontSize: 10, cursor: 'pointer', fontWeight: 500,
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Full page preview */}
            <div style={{ flex: 1, overflow: 'auto', background: '#f0f0f0', display: 'flex', justifyContent: 'center', padding: 16 }}>
              <iframe
                src={`${API}/extracted/${fullPageFile}`}
                style={{ width: 1440, border: 'none', display: 'block', background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                title="Full page preview"
              />
            </div>

            {/* Bottom bar — add to canvas */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => { onImportPage(fullPageFile, pageTab); onClose(); }} style={{
                flex: 1, padding: '10px', background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Add full page to canvas
              </button>
              <button onClick={() => setStep('url')} style={{
                padding: '10px 20px', background: 'none', border: '1px solid #e5e7eb',
                borderRadius: 8, fontSize: 12, color: '#6b7280', cursor: 'pointer',
              }}>
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step: Extracting */}
        {step === 'extracting' && (
          <div style={{ ...s.body, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48 }}>
            <Loader size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 16 }}>Extracting section...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div style={s.body}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e' }}>Section extracted!</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{result.file}</div>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', height: 180, marginBottom: 16 }}>
              <iframe
                src={`${API}/extracted/${result.file}`}
                style={{ width: '200%', height: 360, border: 'none', transform: 'scale(0.5)', transformOrigin: '0 0' }}
                title="Preview"
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onImport(result.file, result.sectionId, result.blocks); onClose(); }} style={s.btn}>
                Add to canvas
              </button>
              <button onClick={() => setStep('browse')} style={s.backBtn}>
                Import more
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 99999, backdropFilter: 'blur(4px)',
  },
  modal: {
    width: '88vw', maxWidth: 1000, height: '88vh', background: '#fff', borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    padding: '12px 20px', borderBottom: '1px solid #f3f4f6',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 4,
  },
  body: { padding: 24 },
  label: { fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10,
    fontSize: 14, color: '#374151', outline: 'none',
  },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 8 },
  error: { fontSize: 11, color: '#ef4444', marginTop: 6 },
  btn: {
    flex: 1, padding: '12px', background: '#6366f1', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  backBtn: {
    padding: '12px 20px', background: 'none', border: '1px solid #e5e7eb',
    borderRadius: 10, fontSize: 12, color: '#6b7280', cursor: 'pointer',
  },
  pageBtn: {
    flex: 1, padding: '14px 16px', background: '#f9fafb', border: '1px solid #e5e7eb',
    borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#374151',
    transition: 'all 0.15s',
  },
};

export default ImportModal;

import React, { useState, useRef, useEffect } from 'react';
import { ThemeSettings, PageType } from './types';

const API = 'http://localhost:3007';

interface Props {
  pageType: PageType;
  label: string;
  settings: ThemeSettings;
  themeId: number;
  x: number;
  y: number;
  refreshTrigger?: number;
}

const LivePageFrame: React.FC<Props> = ({ pageType, label, settings, themeId, x, y, refreshTrigger = 0 }) => {
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [iframeHeight, setIframeHeight] = useState(3000);
  const initialLoad = useRef(true);
  const [sections, setSections] = useState<{ key: string; type: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = `${API}/api/shopify/preview/${pageType}?refresh=${refreshKey}&page=${pageType}`;

  // Auto-refresh when parent triggers (after settings/section push)
  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return; }
    // Delay slightly to let Shopify process the API write
    const timer = setTimeout(() => {
      setLoading(true);
      setRefreshKey(k => k + 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [refreshTrigger]);

  // Listen for height reports from THIS iframe only (matched by pageType)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'iframeHeight' && e.data.page === pageType && e.data.height > 100) {
        setIframeHeight(e.data.height);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pageType]);

  // Fetch section labels from template JSON
  useEffect(() => {
    fetch(`${API}/api/shopify/theme/${themeId}/page-sections/${pageType}`)
      .then(r => r.json())
      .then(data => {
        if (data.sections) setSections(data.sections);
      })
      .catch(() => {});
  }, [themeId, pageType, refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey(k => k + 1);
  };

  const onIframeLoad = () => {
    setLoading(false);
    // Also try reading height directly (works for same-origin)
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        if (h > 100) setIframeHeight(h);
      }
    } catch {}
  };

  const width = settings.page_width;

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width: width + 2,
    }}>
      {/* Frame header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: '#18181b', borderRadius: '8px 8px 0 0',
        borderBottom: '2px solid #6366f1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{label}</span>
          <span style={{
            fontSize: 10, color: '#6366f1', background: '#6366f120',
            padding: '2px 8px', borderRadius: 10, fontWeight: 600,
          }}>LIVE</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleRefresh} style={{
            padding: '3px 10px', borderRadius: 4, border: '1px solid #3f3f46',
            background: '#27272a', color: '#a1a1aa', fontSize: 10, cursor: 'pointer',
          }}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Section labels sidebar */}
      {sections.length > 0 && (
        <div style={{
          position: 'absolute', left: -160, top: 40, width: 150,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {sections.map((sec, i) => (
            <div key={sec.key} style={{
              fontSize: 10, color: '#6b7280', background: '#f9fafb',
              padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              <span style={{ color: '#9ca3af' }}>{i + 1}.</span> {sec.type}
            </div>
          ))}
        </div>
      )}

      {/* Iframe container — no scroll, full height */}
      <div style={{
        position: 'relative',
        border: '1px solid #e5e7eb',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        background: '#fff',
      }}>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          onLoad={onIframeLoad}
          scrolling="no"
          style={{
            width: width,
            height: iframeHeight,
            border: 'none',
            display: 'block',
            overflow: 'hidden',
          }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
};

export default LivePageFrame;

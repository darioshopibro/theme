import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  onAddSection?: (page: PageType, position: number) => void;
}

const LivePageFrame: React.FC<Props> = ({ pageType, label, settings, themeId, x, y, refreshTrigger = 0, onAddSection }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [iframeHeight, setIframeHeight] = useState(3000);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoad = useRef(true);
  const [sections, setSections] = useState<{ key: string; type: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = `${API}/api/shopify/preview/${pageType}?refresh=${refreshKey}&page=${pageType}`;

  // Auto-refresh when parent triggers (after settings/section push)
  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return; }
    const timer = setTimeout(() => {
      setRefreshing(true);
      // Force re-fetch from Puppeteer
      fetch(`${API}/api/shopify/preview/${pageType}?refresh=1&page=${pageType}`)
        .then(() => {
          setRefreshKey(k => k + 1);
          setRefreshing(false);
        })
        .catch(() => setRefreshing(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, [refreshTrigger, pageType]);

  // Handle messages from iframe (section interactions)
  const handleIframeMessage = useCallback((e: MessageEvent) => {
    if (!e.data?.page || e.data.page !== pageType) return;

    switch (e.data.type) {
      case 'iframeHeight':
        if (e.data.height > 100) setIframeHeight(e.data.height);
        break;

      case 'addSection':
        if (onAddSection) onAddSection(pageType, e.data.position);
        break;

      case 'moveSection': {
        const { sectionId, direction } = e.data;
        const currentOrder = sections.map(s => s.key);
        const idx = currentOrder.indexOf(sectionId);
        if (idx < 0) break;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= currentOrder.length) break;
        // Swap
        [currentOrder[idx], currentOrder[newIdx]] = [currentOrder[newIdx], currentOrder[idx]];
        // Push to Shopify
        const templateName = pageType === 'homepage' ? 'index' : pageType;
        fetch(`${API}/api/shopify/push-section-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId, page: pageType, order: currentOrder }),
        }).then(() => {
          // Invalidate + refresh
          fetch(`${API}/api/shopify/invalidate-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: [pageType] }),
          }).then(() => {
            setRefreshing(true);
            fetch(`${API}/api/shopify/preview/${pageType}?refresh=1&page=${pageType}`)
              .then(() => {
                setRefreshKey(k => k + 1);
                setSections(currentOrder.map(k => ({ key: k, type: sections.find(s => s.key === k)?.type || k })));
                setRefreshing(false);
              });
          });
        }).catch(e => console.error('Move failed:', e));
        break;
      }

      case 'removeSection': {
        const { sectionId: removeId } = e.data;
        fetch(`${API}/api/shopify/remove-section`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId, page: pageType, sectionKey: removeId }),
        }).then(() => {
          fetch(`${API}/api/shopify/invalidate-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: [pageType] }),
          }).then(() => {
            setRefreshing(true);
            fetch(`${API}/api/shopify/preview/${pageType}?refresh=1&page=${pageType}`)
              .then(() => {
                setRefreshKey(k => k + 1);
                setSections(prev => prev.filter(s => s.key !== removeId));
                setRefreshing(false);
              });
          });
        }).catch(e => console.error('Remove failed:', e));
        break;
      }

      case 'sectionSelected':
        // Could show settings panel in future
        break;
    }
  }, [pageType, themeId, sections, onAddSection]);

  useEffect(() => {
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [handleIframeMessage]);

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
    setRefreshing(true);
    fetch(`${API}/api/shopify/invalidate-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: [pageType] }),
    }).then(() => {
      fetch(`${API}/api/shopify/preview/${pageType}?refresh=1&page=${pageType}`)
        .then(() => {
          setRefreshKey(k => k + 1);
          setRefreshing(false);
        });
    });
  };

  const onIframeLoad = () => {
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
            width: 8, height: 8, borderRadius: '50%',
            background: refreshing ? '#f59e0b' : '#22c55e',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>{label}</span>
          <span style={{
            fontSize: 10, color: '#6366f1', background: '#6366f120',
            padding: '2px 8px', borderRadius: 10, fontWeight: 600,
          }}>LIVE</span>
          {refreshing && (
            <span style={{ fontSize: 10, color: '#f59e0b' }}>Updating...</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={handleRefresh} style={{
            padding: '3px 10px', borderRadius: 4, border: '1px solid #3f3f46',
            background: '#27272a', color: '#a1a1aa', fontSize: 10, cursor: 'pointer',
          }}>Refresh</button>
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

      {/* Iframe container */}
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

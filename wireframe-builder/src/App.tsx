import React, { useState, useEffect } from 'react';
import { ThemeSettings, ThemeSection, SectionGroup, LibrarySection, PageType, ImportedBlock, ShopifyConnection, ViewMode, DEFAULT_SETTINGS, SECTION_TEMPLATES, DEFAULT_SECTION_SETTINGS, GROUP_COLORS } from './types';
import { getFontImportUrl, settingsToCSS } from './css-vars';
import SettingsSidebar from './SettingsSidebar';
import Canvas from './Canvas';
import PageFrame from './PageFrame';
import SectionBlock from './SectionBlock';
import ImportModal from './ImportModal';
import BottomDrawer from './BottomDrawer';
import ShopifyConnect from './ShopifyConnect';
import LivePageFrame from './LivePageFrame';

function getDefaultSections(pageType: PageType): ThemeSection[] {
  return Object.entries(SECTION_TEMPLATES)
    .filter(([_, t]) => t.pages.includes(pageType))
    .map(([type, t], i) => ({
      id: `${pageType}-${type}-${i}`,
      type, heading: null, visible: true, order: i, height: t.defaultHeight,
      settings: { ...DEFAULT_SECTION_SETTINGS },
    }));
}

// State persistence — disk via server API (not localStorage)
const API = 'http://localhost:3007';

function loadStateFromServer(): Promise<any> {
  return fetch(`${API}/api/state`).then(r => r.json()).then(data => {
    if (!data) return null;
    if (data.canvasSections) {
      data.canvasSections = data.canvasSections.filter((s: any) => !s.importedHtml || s.importedHtml !== 'undefined');
    }
    if (data.canvasPages) {
      data.canvasPages = data.canvasPages.map((p: any) => ({ id: p.id, file: p.file, name: p.name }));
    }
    return data;
  }).catch(() => null);
}

function saveState(data: any) {
  fetch(`${API}/api/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

const App: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [sections, setSections] = useState<Record<PageType, ThemeSection[]>>({
    homepage: getDefaultSections('homepage'),
    collection: getDefaultSections('collection'),
    product: getDefaultSections('product'),
  });
  const [preview, setPreview] = useState<{ page: PageType; mobile: boolean; width: number } | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Shopify connection
  const [shopify, setShopify] = useState<ShopifyConnection | null>(null);
  const [showShopifyConnect, setShowShopifyConnect] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('wireframe');
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);

  // Debounced push settings to Shopify
  const settingsPushTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushSettingsToShopify = React.useCallback((newSettings: ThemeSettings) => {
    if (!shopify?.themeId) return;
    if (settingsPushTimer.current) clearTimeout(settingsPushTimer.current);
    settingsPushTimer.current = setTimeout(() => {
      fetch(`${API}/api/shopify/push-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: shopify.themeId, settings: newSettings }),
      }).then(r => r.json()).then(data => {
        if (data.ok) {
          console.log('Settings pushed to Shopify');
          setLiveRefreshKey(k => k + 1);
        }
      }).catch(e => console.error('Push settings failed:', e));
    }, 1500); // 1.5s debounce
  }, [shopify?.themeId]);

  // Sync wireframe sections from Shopify theme
  const syncThemeSections = async (themeId: number) => {
    try {
      const res = await fetch(`${API}/api/shopify/sync-wireframe/${themeId}`);
      const data = await res.json();
      if (data.homepage || data.collection || data.product) {
        setSections({
          homepage: data.homepage || [],
          collection: data.collection || [],
          product: data.product || [],
        });
      }
    } catch (e) {
      console.error('Failed to sync theme sections:', e);
    }
  };

  // Sync settings (colors, fonts, etc.) from Shopify theme
  const syncThemeSettings = async (themeId: number) => {
    try {
      const res = await fetch(`${API}/api/shopify/sync-settings/${themeId}`);
      const mapped = await res.json();
      if (!mapped.error) {
        setSettings(prev => ({ ...prev, ...mapped }));
      }
    } catch (e) {
      console.error('Failed to sync theme settings:', e);
    }
  };

  // Load state from server on mount
  useEffect(() => {
    loadStateFromServer().then(data => {
      if (data) {
        if (data.settings) setSettings(data.settings);
        if (data.sections) setSections(data.sections);
        if (data.canvasSections) setCanvasSections(data.canvasSections);
        if (data.canvasPages) setCanvasPages(data.canvasPages);
        if (data.groups) setGroups(data.groups);
        if (data.librarySections) setLibrarySections(data.librarySections);
      }
      setLoaded(true);
    });

    // Check Shopify connection and sync sections
    fetch(`${API}/api/shopify/status`).then(r => r.json()).then(data => {
      if (data.connected) {
        setShopify(data as ShopifyConnection);
        syncThemeSections(data.themeId);
        syncThemeSettings(data.themeId);
        // Pre-fetch live previews in background
        fetch(`${API}/api/shopify/prefetch-previews`, { method: 'POST' }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Undo system
  const [history, setHistory] = useState<{ sections: Record<PageType, ThemeSection[]>; canvasSections: ThemeSection[]; groups: SectionGroup[] }[]>([]);
  const pushHistory = () => {
    setHistory(prev => [...prev.slice(-30), { sections: JSON.parse(JSON.stringify(sections)), canvasSections: JSON.parse(JSON.stringify(canvasSections)), groups: JSON.parse(JSON.stringify(groups)) }]);
  };
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setSections(prev.sections);
    setCanvasSections(prev.canvasSections);
    setGroups(prev.groups);
    setHistory(h => h.slice(0, -1));
  };

  // Global selected element (for delete with Backspace/Delete)
  const [selectedElement, setSelectedElement] = useState<{ type: 'canvas-section' | 'page-section'; id: string; page?: PageType } | null>(null);
  const selectedRef = React.useRef(selectedElement);
  selectedRef.current = selectedElement;

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        setHistory(prev => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          setSections(last.sections);
          setCanvasSections(last.canvasSections);
          setGroups(last.groups);
          return prev.slice(0, -1);
        });
      }

      if (e.key === 'Escape') {
        setSelectedElement(null);
        setShowImport(false);
        setPreview(null);
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        const sel = selectedRef.current;
        if (!sel) return;
        e.preventDefault();
        if (sel.type === 'canvas-section') {
          setCanvasSections(prev => prev.filter(s => s.id !== sel.id));
        } else if (sel.type === 'page-section' && sel.page) {
          setSections(prev => ({
            ...prev,
            [sel.page!]: prev[sel.page!].filter(s => s.id !== sel.id),
          }));
        }
        setSelectedElement(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const updateSections = (page: PageType, s: ThemeSection[]) => {
    pushHistory();
    setSections(prev => ({ ...prev, [page]: s }));

    // Push section order to Shopify if connected
    if (shopify?.themeId) {
      const shopifyKeys = s.filter(sec => sec.visible).map(sec => {
        // Use shopifyKey if available (synced from theme), otherwise section type
        return (sec as any).shopifyKey || sec.id;
      });
      // Only push if sections have shopifyKeys (came from theme sync)
      if (s.some((sec: any) => sec.shopifyKey)) {
        fetch(`${API}/api/shopify/push-section-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId: shopify.themeId, page, order: shopifyKeys }),
        }).then(() => {
          setLiveRefreshKey(k => k + 1);
        }).catch(e => console.error('Push order failed:', e));
      }
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify({ settings, sections }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'theme-config.json'; a.click();
  };

  // Imported sections on canvas (not in any page yet)
  const [canvasSections, setCanvasSections] = useState<ThemeSection[]>([]);

  // Library sections (new flow)
  const [librarySections, setLibrarySections] = useState<LibrarySection[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

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
  const [canvasPages, setCanvasPages] = useState<{ id: string; file: string; name: string }[]>([]);
  const [groups, setGroups] = useState<SectionGroup[]>([]);

  // Auto-save to server (only after initial load completes)
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => saveState({ settings, sections, canvasSections, canvasPages, groups, librarySections }), 500);
    return () => clearTimeout(t);
  }, [loaded, settings, sections, canvasSections, canvasPages, groups, librarySections]);

  const handleImportPage = (file: string, pageName: string, recommended?: Record<string, any>) => {
    // Compute page width AFTER applying recommended settings
    let effectiveWidth = settings.page_width;
    if (recommended) {
      if (recommended.page_width) effectiveWidth = Math.max(effectiveWidth, recommended.page_width);
      setSettings(prev => {
        const updated = { ...prev };
        for (const [key, val] of Object.entries(recommended)) {
          if (val != null && key in updated) {
            (updated as any)[key] = val;
          }
        }
        return updated;
      });
    }
    setCanvasPages(prev => [...prev, {
      id: `page-${Date.now()}`,
      file,
      name: pageName,
    }]);
  };

  // When user clicks a section in imported page → extract and add to Library
  const handleSectionPick = async (sectionId: string, sectionType: string, height: number, sourceFile: string) => {
    try {
      const res = await fetch('http://localhost:3007/api/extract-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: sourceFile, sectionId }),
      });
      const data = await res.json();
      if (data.error) { console.error('Extract failed:', data.error); return; }

      const normalizedType = (data.sectionType || sectionType).replace(/_/g, '-');
      const theme = (data.file || sourceFile).split('__')[0] || 'unknown';
      const libSection: LibrarySection = {
        id: `lib-${Date.now()}`,
        status: 'imported',
        sourceTheme: theme,
        sourceFile: data.file || sourceFile,
        importedAt: new Date().toISOString(),
        sectionType: normalizedType,
        height: height || 500,
      };

      setLibrarySections(prev => [...prev, libSection]);
      setDrawerOpen(true);

      // AI group suggestion (fire and forget)
      fetch('http://localhost:3007/api/suggest-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionType: normalizedType, existingGroups: groups.map(g => ({ id: g.id, name: g.name })) }),
      }).then(r => r.json()).then(suggestion => {
        setLibrarySections(prev => prev.map(ls => ls.id === libSection.id ? {
          ...ls,
          suggestedGroupId: suggestion.groupId,
          suggestedGroupName: suggestion.groupName,
        } : ls));
      }).catch(() => {});
    } catch (e) {
      console.error('Section pick failed:', e);
    }
  };

  const removeCanvasPage = (id: string) => {
    setCanvasPages(prev => prev.filter(p => p.id !== id));
  };

  // Group handlers
  const createGroup = (name: string) => {
    setGroups(prev => [...prev, {
      id: `group-${Date.now()}`,
      name,
      color: GROUP_COLORS[prev.length % GROUP_COLORS.length],
      sections: [],
    }]);
  };

  const deleteGroup = (id: string) => setGroups(prev => prev.filter(g => g.id !== id));

  const renameGroup = (id: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
  };

  const addSectionToGroup = (sectionId: string, groupId: string) => {
    const sec = canvasSections.find(s => s.id === sectionId);
    if (!sec) return;
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, sections: [...g.sections, sec] } : g));
    setCanvasSections(prev => prev.filter(s => s.id !== sectionId));
  };

  const removeSectionFromGroup = (sectionId: string, groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    const sec = group?.sections.find(s => s.id === sectionId);
    if (!sec) return;
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, sections: g.sections.filter(s => s.id !== sectionId) } : g));
    setCanvasSections(prev => [...prev, sec]);
  };

  const addGroupToCanvas = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setCanvasSections(prev => [...prev, ...group.sections.map(s => ({ ...s, id: `${s.id}-${Date.now()}` }))]);
  };

  const addGroupToPage = (groupId: string, page: PageType) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    updateSections(page, [...sections[page], ...group.sections.map((s, i) => ({ ...s, id: `${s.id}-${Date.now()}-${i}`, order: sections[page].length + i }))]);
  };

  // ── Library handlers ──

  // Process a library section — send to queue for analysis
  const handleLibraryProcess = async (libSectionId: string) => {
    const ls = librarySections.find(s => s.id === libSectionId);
    if (!ls || ls.status !== 'imported') return;

    setLibrarySections(prev => prev.map(s => s.id === libSectionId ? { ...s, status: 'processing' as const } : s));

    try {
      const htmlRes = await fetch(`http://localhost:3007/extracted/${ls.sourceFile}`);
      const sectionHtml = await htmlRes.text();

      const queueRes = await fetch('http://localhost:3007/api/queue-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionHtml: sectionHtml.slice(0, 50000),
          sectionType: ls.sectionType,
          themeSettings: settings,
          sourceFile: ls.sourceFile,
        }),
      });
      const { id: queueId } = await queueRes.json();

      setLibrarySections(prev => prev.map(s => s.id === libSectionId ? { ...s, queueId } : s));

      // Poll for result — no timeout, keeps checking until result arrives
      const poll = async () => {
        try {
          const checkRes = await fetch(`http://localhost:3007/api/queue/${queueId}`);
          const checkData = await checkRes.json();
          if (checkData.status === 'done' && checkData.result) {
            const r = checkData.result;
            setLibrarySections(prev => prev.map(s => s.id === libSectionId ? {
              ...s,
              status: 'ready' as const,
              wireframeResult: {
                type: (r.wireframeSection.type || '').replace(/_/g, '-'),
                heading: r.wireframeSection.settings?.heading || r.wireframeSection.heading || '',
                settings: r.wireframeSection.settings,
                analysis: r.analysis,
                recommendedThemeChanges: r.recommendedThemeChanges,
              },
            } : s));
            return;
          }
        } catch (e) {}
        setTimeout(poll, 2000);
      };
      setTimeout(poll, 1500);
    } catch (e) {
      setLibrarySections(prev => prev.map(s => s.id === libSectionId ? { ...s, status: 'error' as const, error: String(e) } : s));
    }
  };

  // Add a ready library section to a page frame
  const handleLibraryAddToPage = (libSectionId: string, page: PageType) => {
    const ls = librarySections.find(s => s.id === libSectionId);
    if (!ls || ls.status !== 'ready' || !ls.wireframeResult) return;

    pushHistory();
    const wireframe: ThemeSection = {
      id: `wf-${Date.now()}`,
      type: ls.wireframeResult.type,
      heading: ls.wireframeResult.heading || null,
      visible: true,
      order: sections[page].length,
      height: ls.height || SECTION_TEMPLATES[ls.wireframeResult.type]?.defaultHeight || 400,
      settings: { ...DEFAULT_SECTION_SETTINGS, ...ls.wireframeResult.settings },
    };
    setSections(prev => ({ ...prev, [page]: [...prev[page], wireframe] }));
  };

  // Add original imported section to canvas (as iframe from source)
  const handleLibraryAddToCanvas = (libSectionId: string) => {
    const ls = librarySections.find(s => s.id === libSectionId);
    if (!ls) return;
    pushHistory();
    setCanvasSections(prev => [...prev, {
      id: `canvas-${Date.now()}`,
      type: ls.sectionType,
      heading: `Imported: ${ls.sectionType}`,
      visible: true,
      order: 999,
      height: ls.height || 500,
      settings: { ...DEFAULT_SECTION_SETTINGS },
      importedHtml: ls.sourceFile,
    }]);
  };

  // Move library section to a group
  const handleMoveToGroup = (libSectionId: string, groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const ids = g.librarySectionIds || [];
        if (ids.includes(libSectionId)) return g;
        return { ...g, librarySectionIds: [...ids, libSectionId] };
      }
      // Remove from other groups
      if (g.librarySectionIds?.includes(libSectionId)) {
        return { ...g, librarySectionIds: g.librarySectionIds.filter(id => id !== libSectionId) };
      }
      return g;
    }));
  };

  // Accept AI group suggestion — create group if needed, then move section there
  const handleAcceptGroupSuggestion = (libSectionId: string) => {
    const ls = librarySections.find(s => s.id === libSectionId);
    if (!ls?.suggestedGroupName) return;

    let targetGroupId = ls.suggestedGroupId;
    const existingGroup = groups.find(g => g.id === targetGroupId);

    if (!existingGroup) {
      // Create new group with suggested name
      targetGroupId = `group-${Date.now()}`;
      setGroups(prev => [...prev, {
        id: targetGroupId!,
        name: ls.suggestedGroupName!,
        color: GROUP_COLORS[prev.length % GROUP_COLORS.length],
        sections: [],
        librarySectionIds: [libSectionId],
      }]);
    } else {
      handleMoveToGroup(libSectionId, targetGroupId!);
    }
  };

  // Remove a library section
  const handleRemoveLibrarySection = (libSectionId: string) => {
    setLibrarySections(prev => prev.filter(s => s.id !== libSectionId));
    // Remove from all groups
    setGroups(prev => prev.map(g => ({
      ...g,
      librarySectionIds: (g.librarySectionIds || []).filter(id => id !== libSectionId),
    })));
  };

  // Add wireframe template section directly to a page
  const addWireframeToPage = (type: string, page: PageType) => {
    pushHistory();
    const template = SECTION_TEMPLATES[type];
    const sec: ThemeSection = {
      id: `wf-${Date.now()}`,
      type, heading: null, visible: true,
      order: sections[page].length,
      height: template?.defaultHeight || 200,
      settings: { ...DEFAULT_SECTION_SETTINGS },
    };
    setSections(prev => ({ ...prev, [page]: [...prev[page], sec] }));
  };

  const addWireframeSectionToCanvas = (type: string) => {
    const template = SECTION_TEMPLATES[type];
    const sec: ThemeSection = {
      id: `wire-${Date.now()}`,
      type, heading: null, visible: true, order: 999,
      height: template?.defaultHeight || 200,
      settings: { ...DEFAULT_SECTION_SETTINGS },
    };
    setCanvasSections(prev => [...prev, sec]);
  };

  // Move section from frame back to canvas
  const handleExtractFromFrame = (section: ThemeSection) => {
    pushHistory();
    setCanvasSections(prev => [...prev, { ...section, id: `extracted-${Date.now()}` }]);
  };

  // Add section to page frame
  const handleAddToPage = async (section: ThemeSection, page: PageType) => {
    pushHistory();

    if (section.importedHtml) {
      // Queue for AI analysis via Claude Code hook
      try {
        // Read the extracted HTML for the queue request
        const htmlRes = await fetch(`http://localhost:3007/extracted/${section.importedHtml}`);
        const sectionHtml = await htmlRes.text();

        const queueRes = await fetch('http://localhost:3007/api/queue-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionHtml: sectionHtml.slice(0, 50000),
            sectionType: section.type.replace(/_/g, '-'),
            themeSettings: settings,
            targetPage: page,
            sourceFile: section.importedHtml,
          }),
        });
        const queueData = await queueRes.json();

        // Add placeholder, then poll for AI result
        const placeholderId = `queued-${Date.now()}`;
        const wireframe: ThemeSection = {
          id: placeholderId,
          type: (section.type || 'rich-text').replace(/_/g, '-'),
          heading: `Analyzing: ${section.type}...`,
          visible: true,
          order: sections[page].length,
          height: section.height || 400,
          settings: { ...DEFAULT_SECTION_SETTINGS },
        };
        setSections(prev => ({ ...prev, [page]: [...prev[page], wireframe] }));

        // Poll for result
        if (queueData.id) {
          const pollInterval = setInterval(async () => {
            try {
              const checkRes = await fetch(`http://localhost:3007/api/queue/${queueData.id}`);
              const checkData = await checkRes.json();
              if (checkData.status === 'done' && checkData.result) {
                clearInterval(pollInterval);
                const r = checkData.result;
                setSections(prev => ({
                  ...prev,
                  [page]: prev[page].map(s => s.id === placeholderId ? {
                    ...s,
                    type: (r.wireframeSection.type || '').replace(/_/g, '-'),
                    heading: r.wireframeSection.settings?.heading || r.wireframeSection.heading || null,
                    settings: { ...DEFAULT_SECTION_SETTINGS, ...r.wireframeSection.settings },
                  } : s),
                }));
              }
            } catch (e) {}
          }, 2000);
          // Stop polling after 60s
          setTimeout(() => clearInterval(pollInterval), 60000);
        }
      } catch (e) {
        setSections(prev => ({ ...prev, [page]: [...prev[page], { ...section, id: `copy-${Date.now()}`, order: sections[page].length }] }));
      }
    } else {
      // Wireframe section — move it
      setSections(prev => ({ ...prev, [page]: [...prev[page], { ...section, order: prev[page].length }] }));
      setCanvasSections(prev => prev.filter(s => s.id !== section.id));
    }
  };

  const removeCanvasSection = (id: string) => {
    pushHistory();
    setCanvasSections(prev => prev.filter(s => s.id !== id));
  };

  const updateCanvasSection = (id: string, updated: ThemeSection) => {
    setCanvasSections(prev => prev.map(s => s.id === id ? updated : s));
  };

  // Loading state
  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#e8e8e8' }}>
        <div style={{ fontSize: 13, color: '#666' }}>Loading...</div>
      </div>
    );
  }

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
    <div
      tabIndex={-1}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', outline: 'none' }}
      onMouseDown={(e) => { (e.currentTarget as HTMLElement).focus(); }}
    >
      <SettingsSidebar settings={settings} onChange={(s) => { setSettings(s); pushSettingsToShopify(s); }} minimized={sidebarMinimized} onMinimizeChange={setSidebarMinimized} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '6px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Theme Wireframe
            </div>
            {/* View mode toggle */}
            {shopify?.connected && (
              <div style={{
                display: 'flex', borderRadius: 6, overflow: 'hidden',
                border: '1px solid #e5e7eb',
              }}>
                {(['wireframe', 'live'] as ViewMode[]).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)} style={{
                    padding: '3px 12px', border: 'none', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: viewMode === mode
                      ? (mode === 'live' ? '#22c55e' : '#6366f1')
                      : '#f9fafb',
                    color: viewMode === mode ? '#fff' : '#6b7280',
                  }}>
                    {mode === 'wireframe' ? 'Wireframe' : 'Live'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Shopify connection indicator */}
            {shopify?.connected ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 6, background: '#f0fdf4',
                border: '1px solid #bbf7d0', fontSize: 11, color: '#166534',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                {shopify.shopName}
              </div>
            ) : (
              <button onClick={() => setShowShopifyConnect(true)} style={{
                padding: '4px 14px', borderRadius: 6, border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer', fontWeight: 500,
              }}>Connect Store</button>
            )}
            <button onClick={() => setShowImport(true)} style={{
              padding: '4px 14px', borderRadius: 6, border: 'none', background: '#6366f1',
              color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}>Import Page</button>
          </div>
        </div>

        <Canvas onCanvasClick={() => setSelectedElement(null)}>
          {/* Live frames — always mounted when connected, hidden when wireframe mode */}
          {shopify?.themeId && (
            <div style={{ display: viewMode === 'live' ? 'contents' : 'none' }}>
              <LivePageFrame pageType="homepage" label="Homepage" settings={settings} themeId={shopify.themeId} x={0} y={0} refreshTrigger={liveRefreshKey} />
              <LivePageFrame pageType="collection" label="Collection" settings={settings} themeId={shopify.themeId} x={settings.page_width + 100} y={0} refreshTrigger={liveRefreshKey} />
              <LivePageFrame pageType="product" label="Product" settings={settings} themeId={shopify.themeId} x={(settings.page_width + 100) * 2} y={0} refreshTrigger={liveRefreshKey} />
            </div>
          )}

          {/* Wireframe frames — hidden when live mode */}
          <div style={{ display: viewMode === 'wireframe' ? 'contents' : 'none' }}>
            <PageFrame
              pageType="homepage" label="Homepage"
              sections={sections.homepage} settings={settings}
              onSectionsChange={s => updateSections('homepage', s)}
              onPreview={(p, m) => setPreview({ page: p, mobile: m, width: m ? 375 : settings.page_width })}
              onExtractSection={handleExtractFromFrame}
              onSelectSection={(id, page) => setSelectedElement({ type: 'page-section', id, page })}
              selectedSectionId={selectedElement?.type === 'page-section' ? selectedElement.id : null}
              clearSelection={selectedElement === null}
              x={0} y={0}
            />
            <PageFrame
              pageType="collection" label="Collection"
              sections={sections.collection} settings={settings}
              onSectionsChange={s => updateSections('collection', s)}
              onPreview={(p, m) => setPreview({ page: p, mobile: m, width: m ? 375 : settings.page_width })}
              onExtractSection={handleExtractFromFrame}
              onSelectSection={(id, page) => setSelectedElement({ type: 'page-section', id, page })}
              selectedSectionId={selectedElement?.type === 'page-section' ? selectedElement.id : null}
              clearSelection={selectedElement === null}
              x={settings.page_width + 100} y={0}
            />
            <PageFrame
              pageType="product" label="Product"
              sections={sections.product} settings={settings}
              onSectionsChange={s => updateSections('product', s)}
              onPreview={(p, m) => setPreview({ page: p, mobile: m, width: m ? 375 : settings.page_width })}
              onExtractSection={handleExtractFromFrame}
              onSelectSection={(id, page) => setSelectedElement({ type: 'page-section', id, page })}
              selectedSectionId={selectedElement?.type === 'page-section' ? selectedElement.id : null}
              clearSelection={selectedElement === null}
              x={(settings.page_width + 100) * 2} y={0}
            />
          </div>

          {/* Imported full pages — far right, always calculated from current page_width */}
          {canvasPages.map((pg, i) => {
            const safeX = (Math.max(settings.page_width, 1440) + 100) * 3 + 300;
            return (
              <ImportedPageCard
                key={pg.id}
                file={pg.file}
                name={pg.name}
                initialX={safeX}
                initialY={i * 3500}
                onRemove={() => removeCanvasPage(pg.id)}
                onSectionPick={handleSectionPick}
              />
            );
          })}

          {/* Picked/imported sections — below all page frames, spaced out */}
          {canvasSections.map((sec, i) => (
            <ImportedSectionCard
              key={sec.id}
              section={sec}
              settings={settings}
              initialX={i * 1550}
              initialY={-900}
              onRemove={() => removeCanvasSection(sec.id)}
              onUpdate={(updated) => updateCanvasSection(sec.id, updated)}
              onAddToPage={handleAddToPage}
            />
          ))}
        </Canvas>

        {showShopifyConnect && (
          <ShopifyConnect
            onConnect={(conn) => { setShopify(conn); setShowShopifyConnect(false); setViewMode('live'); if (conn.themeId) { syncThemeSections(conn.themeId); syncThemeSettings(conn.themeId); } }}
            onClose={() => setShowShopifyConnect(false)}
          />
        )}

        {showImport && (
          <ImportModal
            onImport={handleImport}
            onImportPage={handleImportPage}
            onClose={() => setShowImport(false)}
          />
        )}

        <BottomDrawer
          librarySections={librarySections}
          groups={groups}
          onProcess={handleLibraryProcess}
          onAddToPage={handleLibraryAddToPage}
          onAddToCanvas={handleLibraryAddToCanvas}
          onAddWireframeToPage={addWireframeToPage}
          onCreateGroup={createGroup}
          onDeleteGroup={deleteGroup}
          onMoveToGroup={handleMoveToGroup}
          onRemoveSection={handleRemoveLibrarySection}
          onAcceptGroupSuggestion={handleAcceptGroupSuggestion}
          isOpen={drawerOpen}
          onToggle={() => setDrawerOpen(!drawerOpen)}
          sidebarWidth={sidebarMinimized ? 40 : 240}
        />
      </div>
    </div>
  );
};

// Imported section card on canvas — draggable + iframe with edit overlay
const ImportedSectionCard: React.FC<{
  section: ThemeSection;
  settings: ThemeSettings;
  initialX: number;
  initialY: number;
  onRemove: () => void;
  onUpdate: (s: ThemeSection) => void;
  onAddToPage: (section: ThemeSection, page: PageType) => void;
}> = ({ section, settings, initialX, initialY, onRemove, onUpdate, onAddToPage }) => {
  const [editing, setEditing] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(section.height || 600);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const resizeStartY = React.useRef(0);
  const resizeStartH = React.useRef(0);

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

  // Resize effect
  React.useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const newH = Math.max(100, resizeStartH.current + (e.clientY - resizeStartY.current));
      setIframeHeight(newH);
    };
    const onUp = () => {
      setResizing(false);
      onUpdate({ ...section, height: iframeHeight });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing]);

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartH.current = iframeHeight;
  };

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

  // Listen for height updates — only from OUR iframe
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (iframeRef.current && e.source === iframeRef.current.contentWindow) {
        if (e.data?.type === 'IFRAME_HEIGHT') setIframeHeight(e.data.height);
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
          {(['homepage', 'collection', 'product'] as PageType[]).map(p => (
            <button key={p} onClick={() => onAddToPage(section, p)} style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 500, cursor: 'pointer',
              border: '1px solid #6366f1', background: '#eef2ff', color: '#6366f1',
            }}>
              → {p === 'homepage' ? 'HP' : p === 'collection' ? 'Col' : 'PDP'}
            </button>
          ))}
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

      {/* Section content */}
      <div style={{
        width: section.importedHtml ? 1440 : settings.page_width,
        height: iframeHeight,
        background: '#fff', borderRadius: 6,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08), 0 0 0 2px ' + (editing ? '#6366f140' : '#f59e0b40'),
        overflow: 'hidden', position: 'relative',
      }}>
        {section.importedHtml ? (
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
        ) : (
          <div style={{ padding: 0 }}>
            <SectionBlock
              section={section}
              settings={settings}
              isMobile={false}
              onRemove={onRemove}
              onToggleVisibility={() => {}}
            />
          </div>
        )}

        {/* Resize handle */}
        <div
          draggable={false}
          onMouseDown={startResize}
          onDragStart={e => e.preventDefault()}
          style={{
            position: 'absolute', bottom: -6, left: 0, right: 0, height: 18,
            cursor: 'ns-resize', zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            width: 60, height: 4, borderRadius: 2,
            background: resizing ? '#6366f1' : '#d1d5db',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => { if (!resizing) e.currentTarget.style.background = '#6366f1'; }}
            onMouseLeave={e => { if (!resizing) e.currentTarget.style.background = '#d1d5db'; }}
          />
        </div>
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

  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Listen for section picks — only from OUR iframe
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (iframeRef.current && e.source === iframeRef.current.contentWindow) {
        if (e.data?.type === 'SECTION_PICKED') {
          onSectionPick(e.data.sectionId, e.data.sectionType, e.data.height, file);
        }
        if (e.data?.type === 'IFRAME_HEIGHT' && e.data.height > 100) {
          setIframeHeight(e.data.height);
        }
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
          ref={iframeRef}
          src={`http://localhost:3007/extracted/${file}`}
          style={{ width: '100%', height: iframeHeight, border: 'none', pointerEvents: picking ? 'auto' : 'none', display: 'block' }}
          title={name}
        />
      </div>
    </div>
  );
};

export default App;

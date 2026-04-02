import React, { useState, useRef, useEffect } from 'react';
import { LibrarySection, SectionGroup, GROUP_COLORS, SECTION_TEMPLATES, SECTION_PREVIEWS, PageType } from './types';
import { ChevronUp, ChevronDown, FolderPlus, Trash2, Zap, Check, AlertCircle, Loader, Plus, MoreHorizontal } from 'lucide-react';

interface Props {
  librarySections: LibrarySection[];
  groups: SectionGroup[];
  onProcess: (libSectionId: string) => void;
  onAddToPage: (libSectionId: string, page: PageType) => void;
  onAddToCanvas: (libSectionId: string) => void;
  onAddWireframeToPage: (type: string, page: PageType) => void;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (id: string) => void;
  onMoveToGroup: (libSectionId: string, groupId: string) => void;
  onRemoveSection: (libSectionId: string) => void;
  onAcceptGroupSuggestion: (libSectionId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  sidebarWidth?: number;
}

const BottomDrawer: React.FC<Props> = ({
  librarySections, groups,
  onProcess, onAddToPage, onAddToCanvas, onAddWireframeToPage, onCreateGroup, onDeleteGroup,
  onMoveToGroup, onRemoveSection, onAcceptGroupSuggestion,
  isOpen, onToggle, sidebarWidth,
}) => {
  const [height, setHeight] = useState(300);
  const [tab, setTab] = useState<'imported' | 'wireframe' | 'queue' | 'groups'>('imported');
  const [pageFilter, setPageFilter] = useState<PageType | 'all'>('all');
  const [newGroupName, setNewGroupName] = useState('');
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ y: 0, h: 0 });

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => setHeight(Math.max(180, Math.min(600, resizeStart.current.h - (e.clientY - resizeStart.current.y))));
    const onUp = () => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing]);

  const importedCount = librarySections.filter(s => s.status === 'imported').length;
  const readyCount = librarySections.filter(s => s.status === 'ready').length;
  const processingCount = librarySections.filter(s => s.status === 'processing').length;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: sidebarWidth ?? 240, right: 0, zIndex: 100, display: 'flex', flexDirection: 'column', transition: 'left 0.15s' }}>
      {/* Toggle bar */}
      <div
        style={{
          background: '#fff', borderTop: '1px solid #e5e7eb', padding: '5px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isOpen ? <ChevronDown size={13} color="#9ca3af" /> : <ChevronUp size={13} color="#9ca3af" />}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Library</span>
          {importedCount > 0 && <Badge color="#6366f1">{importedCount} new</Badge>}
          {processingCount > 0 && <Badge color="#d97706">{processingCount} processing — waiting for Claude</Badge>}
          {readyCount > 0 && <Badge color="#059669">{readyCount} ready</Badge>}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['imported', 'wireframe', 'queue', 'groups'] as const).map(t => {
            const isActive = tab === t && isOpen;
            const label = t === 'imported' ? `Imported (${librarySections.length})`
              : t === 'wireframe' ? 'Sections'
              : t === 'queue' ? `Queue${processingCount > 0 ? ` (${processingCount})` : ''}`
              : `Groups (${groups.length})`;
            return (
              <button key={t} onClick={e => { e.stopPropagation(); setTab(t); if (!isOpen) onToggle(); }} style={{
                padding: '3px 10px', borderRadius: 5, border: 'none', fontSize: 10, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.1s',
                background: isActive ? '#eef2ff' : 'transparent',
                color: isActive ? '#6366f1' : t === 'queue' && processingCount > 0 ? '#d97706' : '#9ca3af',
              }}>{label}</button>
            );
          })}
        </div>
      </div>

      {isOpen && (
        <div style={{ background: '#fafafa', borderTop: '1px solid #f3f4f6', height, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Resize */}
          <div
            onMouseDown={e => { setResizing(true); resizeStart.current = { y: e.clientY, h: height }; }}
            style={{ height: 3, cursor: 'ns-resize', background: resizing ? '#6366f1' : 'transparent', flexShrink: 0 }}
            onMouseEnter={e => (e.target as HTMLElement).style.background = '#e5e7eb'}
            onMouseLeave={e => { if (!resizing) (e.target as HTMLElement).style.background = 'transparent'; }}
          />

          {/* ── Imported tab ── */}
          {tab === 'imported' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
              {librarySections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 12 }}>
                  Click sections on an imported page to add them here.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {librarySections.map(ls => (
                    <ImportedCard
                      key={ls.id} section={ls} groups={groups}
                      onProcess={() => onProcess(ls.id)}
                      onAddToPage={(page) => onAddToPage(ls.id, page)}
                      onAddToCanvas={() => onAddToCanvas(ls.id)}
                      onMoveToGroup={(gid) => onMoveToGroup(ls.id, gid)}
                      onRemove={() => onRemoveSection(ls.id)}
                      onAcceptSuggestion={() => onAcceptGroupSuggestion(ls.id)}
                      onCreateGroup={onCreateGroup}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Wireframe sections tab ── */}
          {tab === 'wireframe' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
              <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                {(['all', 'homepage', 'collection', 'product'] as const).map(p => (
                  <button key={p} onClick={() => setPageFilter(p)} style={{
                    padding: '3px 10px', borderRadius: 5, border: 'none', fontSize: 10, fontWeight: 500, cursor: 'pointer',
                    background: pageFilter === p ? '#eef2ff' : 'transparent',
                    color: pageFilter === p ? '#6366f1' : '#9ca3af',
                  }}>
                    {p === 'all' ? 'All' : p === 'homepage' ? 'Home' : p === 'collection' ? 'Collection' : 'Product'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(SECTION_TEMPLATES)
                  .filter(([_, t]) => pageFilter === 'all' || t.pages.includes(pageFilter as PageType))
                  .map(([type, tmpl]) => (
                    <WireframeCard key={type} type={type} label={tmpl.label} preview={SECTION_PREVIEWS[type]} pages={tmpl.pages}
                      onAddToPage={(page) => onAddWireframeToPage(type, page)} />
                  ))}
              </div>
            </div>
          )}

          {/* ── Queue tab ── */}
          {tab === 'queue' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
              {librarySections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 12 }}>No sections in queue.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', padding: '4px 12px', fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <div style={{ flex: 2 }}>Section</div>
                    <div style={{ flex: 1 }}>Source</div>
                    <div style={{ width: 80, textAlign: 'center' }}>Status</div>
                    <div style={{ width: 100, textAlign: 'right' }}>Actions</div>
                  </div>
                  {librarySections.map(ls => {
                    const st = { imported: { bg: '#f3f4f6', fg: '#6b7280', label: 'New' }, processing: { bg: '#fef3c7', fg: '#d97706', label: 'Processing' }, ready: { bg: '#d1fae5', fg: '#059669', label: 'Ready' }, error: { bg: '#fee2e2', fg: '#dc2626', label: 'Error' } }[ls.status];
                    return (
                      <div key={ls.id} style={{
                        display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#fff',
                        border: '1px solid #e5e7eb', borderRadius: 6,
                      }}>
                        {/* Name */}
                        <div style={{ flex: 2 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>
                            {ls.wireframeResult?.heading || ls.sectionType.replace(/-/g, ' ')}
                          </div>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>{ls.sectionType}</div>
                        </div>
                        {/* Source */}
                        <div style={{ flex: 1, fontSize: 10, color: '#6b7280' }}>{ls.sourceTheme}</div>
                        {/* Status */}
                        <div style={{ width: 80, textAlign: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.fg }}>{st.label}</span>
                        </div>
                        {/* Actions */}
                        <div style={{ width: 100, display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                          {ls.status === 'imported' && (
                            <button onClick={() => onProcess(ls.id)} style={btnSmallPrimary}>Process</button>
                          )}
                          {ls.status === 'ready' && (
                            <button onClick={() => onAddToCanvas(ls.id)} style={btnSmallPrimary}>Canvas</button>
                          )}
                          <button onClick={() => onRemoveSection(ls.id)} style={{ ...btnSmallOutline, color: '#ef4444', borderColor: '#fecaca' }}>
                            <Trash2 size={9} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Groups tab ── */}
          {tab === 'groups' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  placeholder="New group name..." style={inputStyle}
                  onKeyDown={e => { if (e.key === 'Enter' && newGroupName.trim()) { onCreateGroup(newGroupName.trim()); setNewGroupName(''); } }}
                />
                <button onClick={() => { if (newGroupName.trim()) { onCreateGroup(newGroupName.trim()); setNewGroupName(''); } }}
                  disabled={!newGroupName.trim()}
                  style={{ ...btnPrimary, opacity: newGroupName.trim() ? 1 : 0.4 }}>
                  <Plus size={11} /> Create
                </button>
              </div>
              {groups.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 12 }}>No groups yet.</div>}
              {groups.map(group => {
                const gsections = librarySections.filter(ls => group.librarySectionIds?.includes(ls.id));
                return (
                  <div key={group.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, background: '#fff' }}>
                    <div style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: group.color }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{group.name}</span>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{gsections.length}</span>
                      </div>
                      <button onClick={() => onDeleteGroup(group.id)} style={btnIcon}><Trash2 size={11} color="#ef4444" /></button>
                    </div>
                    <div style={{ padding: 6, display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 32 }}>
                      {gsections.length === 0
                        ? <span style={{ fontSize: 10, color: '#d1d5db', padding: 4 }}>Drag sections here</span>
                        : gsections.map(ls => (
                          <ImportedCard key={ls.id} section={ls} groups={groups} compact
                            onProcess={() => onProcess(ls.id)}
                            onAddToPage={(page) => onAddToPage(ls.id, page)}
                            onAddToCanvas={() => onAddToCanvas(ls.id)}
                            onMoveToGroup={(gid) => onMoveToGroup(ls.id, gid)}
                            onRemove={() => onRemoveSection(ls.id)}
                            onAcceptSuggestion={() => onAcceptGroupSuggestion(ls.id)}
                            onCreateGroup={onCreateGroup}
                          />
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Badge ──
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span style={{ fontSize: 9, fontWeight: 600, color, padding: '1px 6px', borderRadius: 10, background: `${color}12` }}>{children}</span>
);

// ── Imported Section Card ──
const ImportedCard: React.FC<{
  section: LibrarySection; groups: SectionGroup[]; compact?: boolean;
  onProcess: () => void; onAddToPage: (p: PageType) => void; onAddToCanvas: () => void; onMoveToGroup: (gid: string) => void;
  onRemove: () => void; onAcceptSuggestion: () => void; onCreateGroup: (name: string) => void;
}> = ({ section, groups, compact, onProcess, onAddToPage, onAddToCanvas, onMoveToGroup, onRemove, onAcceptSuggestion, onCreateGroup }) => {
  const [menuOpen, setMenuOpen] = useState<null | 'actions' | 'page' | 'group'>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayType = section.sectionType.replace(/-/g, ' ');
  const heading = section.wireframeResult?.heading || section.wireframeResult?.settings?.heading;
  const [newGrp, setNewGrp] = useState('');

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const statusColors = {
    imported: { bg: '#f3f4f6', fg: '#6b7280', label: 'New' },
    processing: { bg: '#fef3c7', fg: '#d97706', label: 'Processing' },
    ready: { bg: '#d1fae5', fg: '#059669', label: 'Ready' },
    error: { bg: '#fee2e2', fg: '#dc2626', label: 'Error' },
  };
  const st = statusColors[section.status];

  return (
    <div style={{
      width: compact ? 130 : 170, background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 8, overflow: 'hidden', position: 'relative',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Preview */}
      <div style={{ width: '100%', height: compact ? 50 : 70, overflow: 'hidden', background: '#f9fafb', position: 'relative' }}>
        <iframe
          src={`http://localhost:3007/extracted/${section.sourceFile}`}
          style={{ width: 1440, height: 900, transform: `scale(${(compact ? 130 : 170) / 1440})`, transformOrigin: 'top left', pointerEvents: 'none', border: 'none' }}
          loading="lazy" sandbox="" title={section.sectionType}
        />
        {/* Status pill */}
        <div style={{
          position: 'absolute', top: 4, right: 4, fontSize: 8, fontWeight: 700,
          padding: '1px 5px', borderRadius: 8, background: st.bg, color: st.fg,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          {section.status === 'processing' && <Loader size={7} style={{ animation: 'spin 1s linear infinite' }} />}
          {section.status === 'ready' && <Check size={7} />}
          {st.label}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '5px 8px 6px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#1f2937', textTransform: 'capitalize', lineHeight: 1.2 }}>
          {heading || displayType}
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>{section.sourceTheme}</div>

        {/* AI suggestion */}
        {section.suggestedGroupName && section.status === 'imported' && (
          <button onClick={onAcceptSuggestion} style={{
            marginTop: 4, padding: '2px 6px', borderRadius: 4, border: '1px solid #6366f120',
            background: '#eef2ff', color: '#6366f1', fontSize: 8, cursor: 'pointer', width: '100%',
            display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500,
          }}>
            {section.suggestedGroupName}
          </button>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 3, marginTop: 5, position: 'relative' }} ref={menuRef}>
          {section.status === 'imported' && (
            <button onClick={onProcess} style={btnSmallPrimary}>Process</button>
          )}
          {section.status === 'ready' && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(menuOpen === 'page' ? null : 'page')} style={btnSmallPrimary}>
                <Plus size={8} /> Add to
              </button>
              {menuOpen === 'page' && (
                <Popup>
                  <PopupItem onClick={() => { onAddToCanvas(); setMenuOpen(null); }}>Canvas</PopupItem>
                  <PopupItem onClick={() => { onAddToPage('homepage'); setMenuOpen(null); }}>Homepage</PopupItem>
                  <PopupItem onClick={() => { onAddToPage('collection'); setMenuOpen(null); }}>Collection</PopupItem>
                  <PopupItem onClick={() => { onAddToPage('product'); setMenuOpen(null); }}>Product</PopupItem>
                </Popup>
              )}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(menuOpen === 'group' ? null : 'group')} style={btnSmallOutline}>
              <FolderPlus size={8} /> Group
            </button>
            {menuOpen === 'group' && (
              <Popup>
                {groups.map(g => (
                  <PopupItem key={g.id} onClick={() => { onMoveToGroup(g.id); setMenuOpen(null); }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                    {g.name}
                  </PopupItem>
                ))}
                <div style={{ borderTop: '1px solid #f3f4f6', padding: '4px 6px', marginTop: 2 }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <input value={newGrp} onChange={e => setNewGrp(e.target.value)} placeholder="New group..."
                      style={{ ...inputStyle, padding: '2px 6px', fontSize: 9 }}
                      onKeyDown={e => { if (e.key === 'Enter' && newGrp.trim()) { onCreateGroup(newGrp.trim()); setNewGrp(''); setMenuOpen(null); } }}
                      onClick={e => e.stopPropagation()} />
                    <button onClick={() => { if (newGrp.trim()) { onCreateGroup(newGrp.trim()); setNewGrp(''); setMenuOpen(null); } }}
                      style={{ ...btnSmallPrimary, padding: '2px 5px' }}><Plus size={8} /></button>
                  </div>
                </div>
              </Popup>
            )}
          </div>
          <button onClick={onRemove} style={{ ...btnSmallOutline, marginLeft: 'auto', color: '#ef4444', borderColor: '#fecaca' }}>
            <Trash2 size={8} />
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

// ── Wireframe Template Card ──
const WireframeCard: React.FC<{
  type: string; label: string; preview: string; pages: PageType[];
  onAddToPage: (p: PageType) => void;
}> = ({ type, label, preview, pages, onAddToPage }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div style={{
      width: 140, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
      padding: '8px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }} ref={ref}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#1f2937' }}>{label}</div>
      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{preview}</div>
      <div style={{ position: 'relative', marginTop: 6 }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={btnSmallPrimary}>
          <Plus size={8} /> Add to page
        </button>
        {menuOpen && (
          <Popup>
            {pages.includes('homepage') && <PopupItem onClick={() => { onAddToPage('homepage'); setMenuOpen(false); }}>Homepage</PopupItem>}
            {pages.includes('collection') && <PopupItem onClick={() => { onAddToPage('collection'); setMenuOpen(false); }}>Collection</PopupItem>}
            {pages.includes('product') && <PopupItem onClick={() => { onAddToPage('product'); setMenuOpen(false); }}>Product</PopupItem>}
          </Popup>
        )}
      </div>
    </div>
  );
};

// ── Popup components ──
const Popup: React.FC<{ children: React.ReactNode; anchorRef?: React.RefObject<HTMLDivElement> }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  useEffect(() => {
    if (ref.current) {
      const parent = ref.current.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
      }
    }
  }, []);

  return (
    <div ref={ref} style={{
      position: 'fixed',
      bottom: pos?.bottom ?? 0,
      left: pos?.left ?? 0,
      background: '#fff',
      border: '1px solid #e5e7eb', borderRadius: 8, padding: 4, zIndex: 200,
      minWidth: 140, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    }}>{children}</div>
  );
};

const PopupItem: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', width: '100%',
    background: 'none', border: 'none', cursor: 'pointer', color: '#374151',
    fontSize: 11, borderRadius: 5, textAlign: 'left', fontWeight: 500,
  }}
    onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
  >{children}</button>
);

// ── Styles ──
const inputStyle: React.CSSProperties = {
  flex: 1, padding: '5px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
  fontSize: 11, outline: 'none', background: '#fff', color: '#374151',
};

const btnPrimary: React.CSSProperties = {
  padding: '5px 12px', background: '#6366f1', color: '#fff', border: 'none',
  borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
};

const btnSmallPrimary: React.CSSProperties = {
  padding: '3px 8px', background: '#6366f1', color: '#fff', border: 'none',
  borderRadius: 5, fontSize: 9, fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 3,
};

const btnSmallOutline: React.CSSProperties = {
  padding: '3px 6px', background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb',
  borderRadius: 5, fontSize: 9, fontWeight: 500, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 3,
};

const btnIcon: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', borderRadius: 4,
};

export default BottomDrawer;

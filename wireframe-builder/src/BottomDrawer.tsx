import React, { useState } from 'react';
import { ThemeSection, SectionGroup, GROUP_COLORS, SECTION_TEMPLATES, PageType } from './types';
import { ChevronUp, ChevronDown, Plus, FolderPlus, Trash2, GripVertical } from 'lucide-react';

interface Props {
  canvasSections: ThemeSection[];
  groups: SectionGroup[];
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (id: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onAddSectionToGroup: (sectionId: string, groupId: string) => void;
  onRemoveSectionFromGroup: (sectionId: string, groupId: string) => void;
  onAddGroupToCanvas: (groupId: string) => void;
  onAddGroupToPage: (groupId: string, page: PageType) => void;
  onAddWireframeSectionToCanvas: (type: string) => void;
}

const BottomDrawer: React.FC<Props> = ({
  canvasSections, groups,
  onCreateGroup, onDeleteGroup, onRenameGroup,
  onAddSectionToGroup, onRemoveSectionFromGroup,
  onAddGroupToCanvas, onAddGroupToPage,
  onAddWireframeSectionToCanvas,
}) => {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(280);
  const [tab, setTab] = useState<'library' | 'groups'>('library');
  const [newGroupName, setNewGroupName] = useState('');
  const [dragSection, setDragSection] = useState<string | null>(null);

  // Resize drawer
  const [resizing, setResizing] = useState(false);
  const resizeStart = React.useRef({ y: 0, h: 0 });

  React.useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const newH = Math.max(150, Math.min(600, resizeStart.current.h - (e.clientY - resizeStart.current.y)));
      setHeight(newH);
    };
    const onUp = () => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing]);

  const wireframeSections = Object.entries(SECTION_TEMPLATES);
  const importedSections = canvasSections.filter(s => s.importedHtml);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 240, right: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Toggle bar */}
      <div
        style={{
          background: '#fff', borderTop: '1px solid #e5e7eb', padding: '4px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            Section Library
          </span>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>
            {importedSections.length} imported · {groups.length} groups
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); setTab('library'); setOpen(true); }} style={{
            ...tabBtn, ...(tab === 'library' && open ? tabBtnActive : {}),
          }}>Library</button>
          <button onClick={e => { e.stopPropagation(); setTab('groups'); setOpen(true); }} style={{
            ...tabBtn, ...(tab === 'groups' && open ? tabBtnActive : {}),
          }}>Groups ({groups.length})</button>
        </div>
      </div>

      {/* Drawer content */}
      {open && (
        <div style={{ background: '#fff', borderTop: '1px solid #f3f4f6', height, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Resize handle */}
          <div
            onMouseDown={e => { setResizing(true); resizeStart.current = { y: e.clientY, h: height }; }}
            style={{ height: 4, cursor: 'ns-resize', background: resizing ? '#6366f1' : 'transparent', flexShrink: 0 }}
            onMouseEnter={e => (e.target as HTMLElement).style.background = '#e5e7eb'}
            onMouseLeave={e => { if (!resizing) (e.target as HTMLElement).style.background = 'transparent'; }}
          />

          {tab === 'library' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {/* Imported sections */}
              {importedSections.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={sectionHeader}>Imported ({importedSections.length})</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {importedSections.map(sec => (
                      <div
                        key={sec.id}
                        draggable
                        onDragStart={() => setDragSection(sec.id)}
                        onDragEnd={() => setDragSection(null)}
                        style={sectionCard}
                      >
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{sec.type}</div>
                        <div style={{ fontSize: 9, color: '#9ca3af' }}>{sec.importedHtml?.split('__')[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wireframe sections */}
              <div style={sectionHeader}>Wireframe Sections</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {wireframeSections.map(([type, tmpl]) => (
                  <button
                    key={type}
                    onClick={() => onAddWireframeSectionToCanvas(type)}
                    style={sectionCard}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{tmpl.label}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{tmpl.pages.join(', ')}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'groups' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {/* Create group */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="New group name..."
                  style={{
                    flex: 1, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6,
                    fontSize: 11, outline: 'none',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && newGroupName) { onCreateGroup(newGroupName); setNewGroupName(''); } }}
                />
                <button
                  onClick={() => { if (newGroupName) { onCreateGroup(newGroupName); setNewGroupName(''); } }}
                  disabled={!newGroupName}
                  style={{
                    padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none',
                    borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    opacity: newGroupName ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <FolderPlus size={12} /> Create
                </button>
              </div>

              {/* Groups list */}
              {groups.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 12 }}>
                  No groups yet. Create one to organize sections.
                </div>
              )}

              {groups.map(group => (
                <div key={group.id} style={{
                  border: `1px solid ${group.color}30`, borderRadius: 8,
                  marginBottom: 10, overflow: 'hidden',
                }}>
                  {/* Group header */}
                  <div style={{
                    padding: '8px 12px', background: `${group.color}08`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: `1px solid ${group.color}20`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: group.color }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{group.name}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{group.sections.length} sections</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button onClick={() => onAddGroupToCanvas(group.id)} style={groupBtn}>Canvas</button>
                      <button onClick={() => onAddGroupToPage(group.id, 'homepage')} style={groupBtn}>→ HP</button>
                      <button onClick={() => onAddGroupToPage(group.id, 'collection')} style={groupBtn}>→ Col</button>
                      <button onClick={() => onAddGroupToPage(group.id, 'product')} style={groupBtn}>→ PDP</button>
                      <button onClick={() => onDeleteGroup(group.id)} style={{ ...groupBtn, color: '#ef4444', borderColor: '#fecaca' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Group sections */}
                  <div
                    style={{ padding: 8, minHeight: 40 }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = `${group.color}10`; }}
                    onDragLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    onDrop={e => {
                      e.currentTarget.style.background = 'transparent';
                      if (dragSection) onAddSectionToGroup(dragSection, group.id);
                    }}
                  >
                    {group.sections.length === 0 ? (
                      <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', padding: 8 }}>
                        Drag sections here
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {group.sections.map(sec => (
                          <div key={sec.id} style={{ ...sectionCard, borderColor: `${group.color}40` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>{sec.type}</span>
                              <button
                                onClick={() => onRemoveSectionFromGroup(sec.id, group.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 10, padding: 0 }}
                              >×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const sectionHeader: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: 6,
};

const sectionCard: React.CSSProperties = {
  padding: '6px 10px', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: 6, cursor: 'grab', minWidth: 100,
};

const tabBtn: React.CSSProperties = {
  padding: '3px 10px', borderRadius: 4, border: '1px solid #e5e7eb',
  background: '#fff', color: '#9ca3af', fontSize: 10, cursor: 'pointer', fontWeight: 500,
};

const tabBtnActive: React.CSSProperties = {
  background: '#eef2ff', borderColor: '#6366f1', color: '#6366f1',
};

const groupBtn: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 4, border: '1px solid #e5e7eb',
  background: '#fff', color: '#6b7280', fontSize: 9, cursor: 'pointer', fontWeight: 500,
};

export default BottomDrawer;

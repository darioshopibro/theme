import React, { useState, useCallback } from 'react';
import { ThemeSettings, SETTINGS_META, SettingMeta, FONT_OPTIONS } from './types';
import { Settings, Palette, Type, Space, RectangleHorizontal, TextCursorInput, CreditCard, Tag } from 'lucide-react';

interface Props {
  settings: ThemeSettings;
  onChange: (settings: ThemeSettings) => void;
  minimized?: boolean;
  onMinimizeChange?: (minimized: boolean) => void;
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
  'Layout': <Settings size={13} />,
  'Colors': <Palette size={13} />,
  'Typography': <Type size={13} />,
  'Spacing': <Space size={13} />,
  'Buttons': <RectangleHorizontal size={13} />,
  'Inputs': <TextCursorInput size={13} />,
  'Cards': <CreditCard size={13} />,
  'Badges': <Tag size={13} />,
};

const SettingsSidebar: React.FC<Props> = ({ settings, onChange, minimized: minimizedProp, onMinimizeChange }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const minimized = minimizedProp ?? false;
  const setMinimized = (v: boolean) => onMinimizeChange?.(v);
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;
  const update = useCallback((id: keyof ThemeSettings, value: string | number) => {
    onChange({ ...settingsRef.current, [id]: value });
  }, [onChange]);

  const groups = SETTINGS_META.reduce<Record<string, SettingMeta[]>>((acc, m) => {
    if (!acc[m.group]) acc[m.group] = [];
    acc[m.group].push(m);
    return acc;
  }, {});

  if (minimized) {
    return (
      <div style={{ width: 40, background: '#fafafa', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', flexShrink: 0, paddingTop: 10 }}>
        <button onClick={() => setMinimized(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#6b7280' }} title="Expand settings">
          <Settings size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: 240, background: '#fafafa', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: '#6366f1' }} />
          <span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Theme Settings</span>
        </div>
        <button onClick={() => setMinimized(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', fontSize: 14 }} title="Minimize">
          ‹
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(groups).map(([group, metas]) => (
          <div key={group} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div
              onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
              style={{
                padding: '8px 14px', fontSize: 11, fontWeight: 600, color: '#6b7280',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                userSelect: 'none', background: collapsed[group] ? 'transparent' : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {GROUP_ICONS[group] || null}
                <span>{group}</span>
              </div>
              <span style={{ fontSize: 9, color: '#bbb' }}>{collapsed[group] ? '▸' : '▾'}</span>
            </div>
            {!collapsed[group] && (
              <div style={{ padding: '4px 14px 10px' }}>
                {metas.map(m => <Control key={m.id} meta={m} value={settings[m.id]} settingId={m.id} onUpdate={update} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Control: React.FC<{ meta: SettingMeta; value: string | number; settingId: keyof ThemeSettings; onUpdate: (id: keyof ThemeSettings, v: string | number) => void }> = React.memo(({ meta, value, settingId, onUpdate }) => {
  const onChange = (v: string | number) => onUpdate(settingId, v);
  if (meta.type === 'range') {
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <label style={{ fontSize: 10, color: '#9ca3af' }}>{meta.label}</label>
          <span style={{ fontSize: 9, color: '#bbb', fontFamily: 'monospace' }}>{value}{meta.unit}</span>
        </div>
        <input type="range" min={meta.min} max={meta.max} step={meta.step} value={value as number} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
      </div>
    );
  }
  if (meta.type === 'color') {
    return (
      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 10, color: '#9ca3af' }}>{meta.label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="color" value={value as string} onChange={e => onChange(e.target.value)} style={{ width: 18, height: 18, border: '1px solid #e5e7eb', borderRadius: 3, cursor: 'pointer', padding: 0 }} />
          <span style={{ fontSize: 9, color: '#bbb', fontFamily: 'monospace' }}>{value}</span>
        </div>
      </div>
    );
  }
  if (meta.type === 'select') {
    return (
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: '#9ca3af' }}>{meta.label}</label>
        <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
          {meta.options?.map(o => (
            <button key={o.value} onClick={() => onChange(o.value)} style={{
              flex: 1, padding: '3px 0', fontSize: 9, border: '1px solid ' + (value === o.value ? '#6366f1' : '#e5e7eb'),
              background: value === o.value ? '#eef2ff' : '#fff', color: value === o.value ? '#6366f1' : '#9ca3af',
              borderRadius: 3, cursor: 'pointer', fontWeight: value === o.value ? 600 : 400,
            }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (meta.type === 'font') {
    return (
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: '#9ca3af' }}>{meta.label}</label>
        <select value={value as string} onChange={e => onChange(e.target.value)} style={{
          width: '100%', padding: '4px 6px', background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 4, color: '#374151', fontSize: 10, marginTop: 3, fontFamily: value as string,
        }}>
          {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
    );
  }
  return null;
});

export default SettingsSidebar;

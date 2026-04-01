import React from 'react';
import { ThemeSection, SectionSettings, SECTION_TEMPLATES } from './types';
import { X } from 'lucide-react';

interface Props {
  section: ThemeSection;
  onChange: (settings: SectionSettings) => void;
  onClose: () => void;
}

const SectionSettingsPopup: React.FC<Props> = ({ section, onChange, onClose }) => {
  const template = SECTION_TEMPLATES[section.type];
  if (!template || template.editableSettings.length === 0) return null;

  const s = section.settings;
  const update = (patch: Partial<SectionSettings>) => onChange({ ...s, ...patch });

  return (
    <div style={{
      width: 240, background: '#fff', borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Arrow pointing left to section */}
      <div style={{
        position: 'absolute', left: -6, top: 16,
        width: 12, height: 12, background: '#fff',
        transform: 'rotate(45deg)',
        boxShadow: '-2px 2px 4px rgba(0,0,0,0.06)',
      }} />
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{template.label}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      {/* Settings */}
      <div style={{ padding: '10px 14px', maxHeight: 340, overflowY: 'auto' }}>
        {template.editableSettings.map(key => {
          switch (key) {
            case 'heading':
              return <TextField key={key} label="Heading" value={s.heading || ''} onChange={v => update({ heading: v })} />;
            case 'subheading':
              return <TextField key={key} label="Subheading" value={s.subheading || ''} onChange={v => update({ subheading: v })} />;
            case 'button_text':
              return <TextField key={key} label="Button text" value={s.button_text || ''} onChange={v => update({ button_text: v })} />;
            case 'columns':
              return <RangeField key={key} label="Columns" value={s.columns || 4} min={1} max={6} onChange={v => update({ columns: v })} />;
            case 'rows':
              return <RangeField key={key} label="Rows" value={s.rows || 2} min={1} max={4} onChange={v => update({ rows: v })} />;
            case 'products_count':
              return <RangeField key={key} label="Products" value={s.products_count || 4} min={2} max={12} onChange={v => update({ products_count: v })} />;
            case 'overlay_opacity':
              return <RangeField key={key} label="Overlay" value={s.overlay_opacity || 0} min={0} max={100} unit="%" onChange={v => update({ overlay_opacity: v })} />;
            case 'bg_color':
              return <ColorField key={key} label="Background" value={s.bg_color || '#000000'} onChange={v => update({ bg_color: v })} />;
            case 'text_align':
              return <SelectField key={key} label="Align" value={s.text_align || 'center'} options={['left', 'center', 'right']} onChange={v => update({ text_align: v as any })} />;
            case 'content_position':
              return <SelectField key={key} label="Position" value={s.content_position || 'center'} options={['left', 'center', 'right']} onChange={v => update({ content_position: v as any })} />;
            case 'button_style':
              return <SelectField key={key} label="Button style" value={s.button_style || 'solid'} options={['solid', 'outline', 'link']} onChange={v => update({ button_style: v as any })} />;
            case 'image_ratio':
              return <SelectField key={key} label="Image ratio" value={s.image_ratio || '1:1'} options={['1:1', '3:4', '4:3', '16:9']} onChange={v => update({ image_ratio: v as any })} />;
            case 'full_width':
              return <CheckField key={key} label="Full width" value={!!s.full_width} onChange={v => update({ full_width: v })} />;
            case 'show_price':
              return <CheckField key={key} label="Show price" value={s.show_price !== false} onChange={v => update({ show_price: v })} />;
            case 'show_vendor':
              return <CheckField key={key} label="Show vendor" value={!!s.show_vendor} onChange={v => update({ show_vendor: v })} />;
            case 'show_badge':
              return <CheckField key={key} label="Show badge" value={!!s.show_badge} onChange={v => update({ show_badge: v })} />;
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};

// Mini form controls
const TextField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div style={{ marginBottom: 8 }}>
    <label style={labelStyle}>{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={label} style={inputStyle} />
  </div>
);

const RangeField: React.FC<{ label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }> = ({ label, value, min, max, unit, onChange }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <label style={labelStyle}>{label}</label>
      <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
  </div>
);

const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <label style={labelStyle}>{label}</label>
    <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 24, height: 24, border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
  </div>
);

const SelectField: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <div style={{ marginBottom: 8 }}>
    <label style={labelStyle}>{label}</label>
    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          flex: 1, padding: '4px 0', fontSize: 10, border: '1px solid ' + (value === o ? '#6366f1' : '#e5e7eb'),
          background: value === o ? '#eef2ff' : '#fff', color: value === o ? '#6366f1' : '#6b7280',
          borderRadius: 4, cursor: 'pointer', fontWeight: value === o ? 600 : 400,
          textTransform: 'capitalize',
        }}>
          {o}
        </button>
      ))}
    </div>
  </div>
);

const CheckField: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <label style={labelStyle}>{label}</label>
    <button onClick={() => onChange(!value)} style={{
      width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
      background: value ? '#6366f1' : '#d1d5db', position: 'relative', transition: 'background 0.15s',
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 7, background: '#fff', position: 'absolute',
        top: 2, left: value ? 16 : 2, transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }} />
    </button>
  </div>
);

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px', background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: 6, color: '#374151', fontSize: 11, marginTop: 4, outline: 'none',
};

export default SectionSettingsPopup;

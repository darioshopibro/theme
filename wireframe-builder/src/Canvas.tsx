import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ZoomProvider } from './ZoomContext';

interface Props {
  children: React.ReactNode;
}

const Canvas: React.FC<Props> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.35);
  const [panX, setPanX] = useState(200);
  const [panY, setPanY] = useState(80);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  zoomRef.current = zoom;
  panXRef.current = panX;
  panYRef.current = panY;

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = zoomRef.current;
      const delta = -e.deltaY * 0.002;
      const newZoom = Math.min(3, Math.max(0.08, oldZoom + delta * oldZoom));

      const scale = newZoom / oldZoom;
      const newPanX = mouseX - scale * (mouseX - panXRef.current);
      const newPanY = mouseY - scale * (mouseY - panYRef.current);

      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);
    } else {
      setPanX(x => x - e.deltaX);
      setPanY(y => y - e.deltaY);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (spaceHeld || e.button === 1) {
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(x => x + (e.clientX - lastMouse.x));
      setPanY(y => y + (e.clientY - lastMouse.y));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };
  const onMouseUp = () => setIsPanning(false);

  const fitAll = () => { setZoom(0.35); setPanX(200); setPanY(80); };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, overflow: 'hidden', position: 'relative',
        cursor: spaceHeld || isPanning ? 'grabbing' : 'default',
        background: '#e8e8e8',
        backgroundImage: `radial-gradient(circle, #d0d0d0 1px, transparent 1px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${panX % (24 * zoom)}px ${panY % (24 * zoom)}px`,
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <ZoomProvider value={zoom}>
        <div style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute', top: 0, left: 0,
        }}>
          {children}
        </div>
      </ZoomProvider>

      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', gap: 2, alignItems: 'center',
        background: '#fff', borderRadius: 8, padding: '3px 6px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: 11, color: '#888',
        border: '1px solid #e5e7eb',
      }}>
        <button onClick={() => setZoom(z => Math.max(0.08, z * 0.8))} style={zBtn}>−</button>
        <span style={{ minWidth: 36, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(3, z * 1.25))} style={zBtn}>+</button>
        <div style={{ width: 1, height: 14, background: '#e5e7eb', margin: '0 4px' }} />
        <button onClick={fitAll} style={{ ...zBtn, fontSize: 9 }}>Fit</button>
      </div>
    </div>
  );
};

const zBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
  color: '#666', padding: '2px 6px', borderRadius: 4, lineHeight: 1,
};

export default Canvas;

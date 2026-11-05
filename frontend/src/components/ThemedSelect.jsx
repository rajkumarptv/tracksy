import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import { THEME } from '../theme';

/* ═══════════════════════════════════════════════════════════════════════
   ThemedSelect — modern animated dropdown, drop-in replacement for <select>.
   Themes itself (light/dark) from the shared dashboard theme.

   Props:
     value      — current value
     onChange   — (val) => void
     options    — [{ value, label, emoji?, sub? }]                (flat)
     groups     — [{ group, items:[{ value, label, emoji?, sub? }] }] (grouped)
     placeholder, searchable (auto when >8 items), disabled
═══════════════════════════════════════════════════════════════════════ */
export default function ThemedSelect({
  value, onChange, options, groups, placeholder = 'Select…',
  searchable, disabled, accent = '#4F46E5', compact = false,
}) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const t = isDark ? THEME.dark : THEME.light;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const searchRef = useRef(null);

  const flat = useMemo(() => {
    if (groups) return groups.flatMap(g => g.items);
    return options || [];
  }, [groups, options]);

  const selected = flat.find(o => String(o.value) === String(value));
  const showSearch = searchable ?? flat.length > 8;

  /* Position the portal panel under the trigger */
  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const belowSpace = window.innerHeight - r.bottom;
    const openUp = belowSpace < 260 && r.top > belowSpace;
    setCoords({
      left: r.left, width: r.width,
      top: openUp ? undefined : r.bottom + 6,
      bottom: openUp ? window.innerHeight - r.top + 6 : undefined,
      maxH: Math.min(320, (openUp ? r.top : belowSpace) - 16),
    });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    const tm = setTimeout(() => searchRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
      clearTimeout(tm);
    };
  }, [open]);

  const filterItem = (o) => !q || o.label.toLowerCase().includes(q.toLowerCase());

  const renderRow = (o) => {
    const sel = String(o.value) === String(value);
    return (
      <button key={o.value} type="button"
        onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
        style={{
          display:'flex', alignItems:'center', gap:11, width:'100%', textAlign:'left',
          padding:'10px 12px', borderRadius:12, border:'none', cursor:'pointer',
          background: sel ? (isDark ? 'rgba(79,70,229,.16)' : '#EEF0FF') : 'transparent',
          transition:'background .12s', fontFamily:'inherit',
        }}
        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : '#F4F5F7'; }}
        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
        {(o.icon || o.emoji !== undefined) && (
          <span style={{ width:30, height:30, borderRadius:9, background: isDark ? 'rgba(255,255,255,.06)' : '#F4F5F7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
            {o.icon || o.emoji}
          </span>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight: sel ? 700 : 500, color: sel ? (isDark ? '#C4B5FD' : accent) : t.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{o.label}</div>
          {o.sub && <div style={{ fontSize:11.5, color:t.text3, marginTop:1 }}>{o.sub}</div>}
        </div>
        {sel && <Check size={16} color={accent} style={{ flexShrink:0 }}/>}
      </button>
    );
  };

  return (
    <>
      {/* Trigger */}
      <button ref={btnRef} type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width:'100%', height: compact ? 38 : 52, borderRadius: compact ? 11 : 14,
          padding: compact ? '0 10px' : '0 14px', boxSizing:'border-box',
          border:`1.5px solid ${open ? accent : t.border}`,
          background: t.surface, cursor: disabled ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', gap: compact ? 7 : 10, fontFamily:'inherit',
          boxShadow: open ? `0 0 0 3px ${accent}22` : 'none',
          transition:'border-color .15s, box-shadow .15s', opacity: disabled ? .6 : 1,
        }}>
        {selected && (selected.icon || selected.emoji !== undefined) && (
          <span style={{ width: compact ? 22 : 30, height: compact ? 22 : 30, borderRadius: compact ? 7 : 9, background: isDark ? 'rgba(255,255,255,.06)' : '#F4F5F7', display:'flex', alignItems:'center', justifyContent:'center', fontSize: compact ? 13 : 16, flexShrink:0 }}>
            {selected.icon || selected.emoji}
          </span>
        )}
        <span style={{ flex:1, textAlign:'left', fontSize: compact ? 13 : 15, fontWeight: selected ? 600 : 400, color: selected ? t.text : t.text3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration:.2 }} style={{ display:'flex', flexShrink:0 }}>
          <ChevronDown size={compact ? 14 : 17} color={t.text3}/>
        </motion.span>
      </button>

      {/* Portal panel */}
      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <>
              <motion.div
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                onClick={() => setOpen(false)}
                style={{ position:'fixed', inset:0, zIndex:2000 }}/>
              <motion.div
                initial={{ opacity:0, y: coords.bottom ? 8 : -8, scale:.98 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y: coords.bottom ? 8 : -8, scale:.98 }}
                transition={{ type:'spring', stiffness:420, damping:30 }}
                style={{
                  position:'fixed', left:coords.left, width:coords.width,
                  top:coords.top, bottom:coords.bottom, zIndex:2001,
                  background: t.cardBg, border:`1px solid ${t.border}`, borderRadius:16,
                  boxShadow:'0 24px 60px rgba(0,0,0,.35)', overflow:'hidden',
                  display:'flex', flexDirection:'column', maxHeight:coords.maxH,
                }}>
                {showSearch && (
                  <div style={{ padding:'10px 12px 6px', borderBottom:`1px solid ${t.divider}`, flexShrink:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, background:t.surface, borderRadius:10, padding:'0 12px', height:40 }}>
                      <Search size={15} color={t.text3}/>
                      <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                        style={{ flex:1, border:'none', outline:'none', background:'transparent', color:t.text, fontSize:14, fontFamily:'inherit' }}/>
                    </div>
                  </div>
                )}
                <div style={{ overflowY:'auto', padding:6, display:'flex', flexDirection:'column', gap:2 }}>
                  {groups ? groups.map(g => {
                    const items = g.items.filter(filterItem);
                    if (!items.length) return null;
                    return (
                      <div key={g.group}>
                        <div style={{ fontSize:10.5, fontWeight:700, color:t.text3, textTransform:'uppercase', letterSpacing:'.06em', padding:'8px 12px 4px' }}>{g.group}</div>
                        {items.map(renderRow)}
                      </div>
                    );
                  }) : flat.filter(filterItem).map(renderRow)}
                  {groups && groups.every(g => !g.items.filter(filterItem).length) && (
                    <div style={{ padding:'18px', textAlign:'center', fontSize:13, color:t.text3 }}>No results</div>
                  )}
                  {!groups && !flat.filter(filterItem).length && (
                    <div style={{ padding:'18px', textAlign:'center', fontSize:13, color:t.text3 }}>No results</div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

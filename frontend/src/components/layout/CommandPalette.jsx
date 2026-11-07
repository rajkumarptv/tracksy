import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { ALL_PAGES } from './nav';
import { track } from '../../lib/analytics';
import styles from './CommandPalette.module.css';

const ACTIONS = [
  { label: 'Add expense',  route: '/transactions?add=expense',  Icon: Plus },
  { label: 'Add income',   route: '/transactions?add=income',   Icon: Plus },
  { label: 'Add transfer', route: '/transactions?add=transfer', Icon: Plus },
];

/** Cmd/Ctrl+K (or the header search button on phones): jump to any screen, add a transaction, or search transactions. */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef(null);

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = [...ACTIONS.map(a => ({ ...a, kind: 'Action' })), ...ALL_PAGES.map(p => ({ label: p.label, route: p.path, Icon: p.Icon, kind: 'Go to' }))];
    const hits = term ? base.filter(i => i.label.toLowerCase().includes(term)) : base;
    return term ? [...hits, { label: `Search transactions for “${q.trim()}”`, route: `/transactions?search=${encodeURIComponent(q.trim())}`, Icon: MagnifyingGlass, kind: 'Search', search: true }] : hits;
  }, [q]);

  if (!open) return null;
  const go = (item) => { if (item.search) track('search_used'); onClose(); navigate(item.route); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && items[idx]) go(items[idx]);
    else if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Search and jump to">
        <div className={styles.inputRow}>
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input ref={input} value={q} onChange={e => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey}
            placeholder="Search or jump to…" aria-label="Search or jump to" role="combobox" aria-expanded="true" aria-controls="cmdk-list" />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <ul id="cmdk-list" role="listbox" className={styles.list}>
          {items.map((it, i) => (
            <li key={it.kind + it.label} role="option" aria-selected={i === idx}>
              <button type="button" className={`${styles.item} ${i === idx ? styles.active : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => go(it)}>
                <it.Icon size={18} aria-hidden="true" />
                <span className={styles.label}>{it.label}</span>
                <span className={styles.kind}>{it.kind}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className={styles.empty}>No matches</li>}
        </ul>
      </div>
    </div>,
    document.body
  );
}

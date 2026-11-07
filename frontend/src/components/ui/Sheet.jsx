import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './primitives.css';

/**
 * The one modal. A bottom sheet on phones, a centred dialog on desktop.
 * <Sheet open onClose title="Add goal" footer={<Button variant="primary">Save</Button>}>…</Sheet>
 * The footer stays pinned, so primary actions are never hidden behind the keyboard or scrolled away.
 */
export default function Sheet({ open, onClose, title, footer, size, children, initialFocusRef }) {
  const panel = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const f = [...panel.current.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    // Don't pop the keyboard on touch screens by focusing a field; focus the panel itself there.
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    (touch ? panel.current : (initialFocusRef?.current || panel.current))?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="ds-sheet__overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={panel} className={`ds-sheet ${size === 'lg' ? 'ds-sheet--lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}>
        <div className="ds-sheet__grab" aria-hidden="true" />
        <div className="ds-sheet__head">
          <h2 className="ds-sheet__title" id={titleId}>{title}</h2>
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="ds-sheet__body">{children}</div>
        {footer && <div className="ds-sheet__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

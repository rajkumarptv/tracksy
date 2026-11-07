import './primitives.css';

/** tabs: [{ key, label }]. Arrow keys move between tabs. */
export default function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  const move = (e, i) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(i + d + tabs.length) % tabs.length];
    onChange(next.key);
    e.currentTarget.parentElement.querySelectorAll('[role=tab]')[tabs.indexOf(next)]?.focus();
  };
  return (
    <div className="ds-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.key} type="button" role="tab" className="ds-tab" aria-selected={value === t.key}
          tabIndex={value === t.key ? 0 : -1} onClick={() => onChange(t.key)} onKeyDown={(e) => move(e, i)}>{t.label}</button>
      ))}
    </div>
  );
}

import './primitives.css';

/** A segmented control: options [{ key, label, tone? }] where tone is income | expense | transfer. */
export default function Segmented({ options, value, onChange, label = 'Choose one' }) {
  return (
    <div className="ds-seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key}
          className={`ds-seg__item ${o.tone ? `ds-seg__item--${o.tone}` : ''}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

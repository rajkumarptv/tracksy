import './primitives.css';

export function Card({ padded = true, className = '', children, ...rest }) {
  return <section className={['ds-card', padded && 'ds-card__pad', className].filter(Boolean).join(' ')} {...rest}>{children}</section>;
}

/** Use with <Card padded={false}>: a titled header row with an optional action, then your content. */
export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="ds-card__head">
      <div style={{ minWidth: 0 }}>
        <h3 className="ds-card__title">{title}</h3>
        {subtitle && <p className="ds-card__sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** A single KPI: small label, large tabular number, optional delta ('up' | 'down'). */
export function Stat({ label, value, delta, deltaTone }) {
  return (
    <div className="ds-stat">
      <span className="ds-stat__label">{label}</span>
      <span className="ds-stat__value">{value}</span>
      {delta && <span className={`ds-stat__delta ${deltaTone ? `ds-stat__delta--${deltaTone}` : ''}`}>{delta}</span>}
    </div>
  );
}

export default Card;

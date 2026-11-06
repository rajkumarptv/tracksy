import './primitives.css';

/** tone: neutral | accent | success | danger | warning. Always include text; never rely on colour alone. */
export default function Badge({ tone = 'neutral', icon, children }) {
  return <span className={`ds-badge ds-badge--${tone}`}>{icon}{children}</span>;
}

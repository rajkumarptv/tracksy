import './primitives.css';

/** variant: primary | secondary | ghost | danger. size: sm | md | lg. icon: element shown before the label. */
export default function Button({ variant = 'secondary', size = 'md', icon, loading = false, block = false, iconOnly = false, className = '', children, type = 'button', ...rest }) {
  const cls = ['ds-btn', `ds-btn--${variant}`, size !== 'md' && `ds-btn--${size}`, block && 'ds-btn--block', iconOnly && 'ds-btn--icon', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} aria-busy={loading || undefined} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="ds-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

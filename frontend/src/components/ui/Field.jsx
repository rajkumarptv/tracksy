import { useId, cloneElement, isValidElement } from 'react';
import { AlertCircle } from 'lucide-react';
import ThemedSelect from '../ThemedSelect';
import './primitives.css';

/** Label + control + hint/error. Pass one control as the child; it gets the id and aria wiring. */
export function Field({ label, hint, error, children }) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? `${id}-msg` : undefined })
    : children;
  return (
    <div className="ds-field">
      {label && <label className="ds-field__label" htmlFor={id}>{label}</label>}
      {control}
      {error
        ? <span id={`${id}-msg`} className="ds-field__error" role="alert"><AlertCircle size={13} aria-hidden="true" />{error}</span>
        : hint && <span id={`${id}-msg`} className="ds-field__hint">{hint}</span>}
    </div>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={`ds-input ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`ds-input ${className}`} {...rest} />;
}

/** Themed dropdown with the same props as ThemedSelect (options or groups). */
export function Select(props) {
  return <ThemedSelect {...props} />;
}

export default Field;

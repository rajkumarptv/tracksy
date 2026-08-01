import { Eye, EyeOff } from 'lucide-react';
import usePrivacyStore from '../store/privacyStore';

/* Eye icon that hides/reveals every amount in the app.
   Hiding is instant; revealing asks for the password when one is set
   (configured in Settings → Privacy). */
export default function AmountToggle({ size = 16, color }) {
  const { hidden, passwordHash, setHidden, setPassword, verify } = usePrivacyStore();
  const Icon = hidden ? EyeOff : Eye;

  const onClick = (e) => {
    e?.stopPropagation?.();
    if (hidden) {
      // Revealing → always require the password once one exists
      if (passwordHash) {
        const pw = window.prompt('Enter password to reveal amounts');
        if (pw == null) return;              // cancelled
        if (!verify(pw)) { window.alert('Incorrect password'); return; }
      }
      setHidden(false);
    } else {
      // Hiding → if no password yet, ask the user to create one now so that
      // revealing is protected. (They can also manage it in Settings → Privacy.)
      if (!passwordHash) {
        const pw = window.prompt('Set a password to lock hidden amounts.\nEnter a password (or leave blank to hide without one):');
        if (pw === null) return;             // cancelled → don't hide
        if (pw.trim()) {
          const confirm = window.prompt('Confirm your password:');
          if (confirm === null) return;
          if (confirm !== pw) { window.alert('Passwords did not match — try again from the eye icon.'); return; }
          setPassword(pw);
        }
      }
      setHidden(true);
    }
  };

  return (
    <Icon size={size} color={color} onClick={onClick} style={{ cursor: 'pointer' }}
      role="button" aria-label={hidden ? 'Reveal amounts' : 'Hide amounts'} />
  );
}

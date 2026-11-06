// Promise-based replacement for window.confirm. <ConfirmHost/> (mounted once in App) renders the dialog.
// Native confirm() is blocked or restyled by some mobile/in-app browsers, so destructive actions use this.
let open = null;
export const registerConfirmHost = (fn) => { open = fn; return () => { if (open === fn) open = null; }; };
export function confirmAsync(message, { confirmLabel = 'Delete', danger = true } = {}) {
  if (!open) return Promise.resolve(typeof window !== 'undefined' && window.confirm ? window.confirm(message) : false);
  return new Promise(resolve => open({ message, confirmLabel, danger, resolve }));
}

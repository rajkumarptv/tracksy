// Fills the %VITE_GTM_ID% placeholder in index.html.
// Production builds default to the Tracksy container, so the tag ships even though .env files are
// git-ignored in this repo. Anything else (dev, preview) loads nothing unless VITE_GTM_ID is set.
export const DEFAULT_GTM_ID = 'GTM-KMVKKZK8';
const VALID = /^GTM-[A-Z0-9]+$/;

export function resolveGtmId(mode, env = {}) {
  const fromEnv = (env.VITE_GTM_ID || '').trim();
  if (fromEnv) return VALID.test(fromEnv) ? fromEnv : '';   // explicit but malformed: load nothing
  return mode === 'production' ? DEFAULT_GTM_ID : '';
}

export function gtmHtmlPlugin(mode, env = {}) {
  const id = resolveGtmId(mode, env);
  return {
    name: 'tracksy-gtm-id',
    // run before Vite's own %ENV% replacement so our default wins when no env var is set
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%VITE_GTM_ID%', id) },
  };
}

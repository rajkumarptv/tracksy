// Build-time analytics wiring for index.html.
//
// Default: send events straight to Google Analytics 4 with the standard gtag.js tag.
// Production builds use the Tracksy measurement id below, so nothing depends on a .env file (.env files are
// git-ignored in this repo). Dev and preview builds load nothing unless VITE_GA_MEASUREMENT_ID is set.
//
// Optional: Google Tag Manager. It stays off unless VITE_GTM_ID is set, and then direct GA4 is switched off,
// so the same event can never be sent twice.
export const DEFAULT_GA_ID = 'G-TNP5J4QCZL';
const GA_RE = /^G-[A-Z0-9]+$/;
const GTM_RE = /^GTM-[A-Z0-9]+$/;

export function resolveAnalytics(mode, env = {}) {
  const gtmEnv = (env.VITE_GTM_ID || '').trim();
  const gtmId = GTM_RE.test(gtmEnv) ? gtmEnv : '';
  if (gtmId) return { gaId: '', gtmId };                       // GTM chosen explicitly: no direct GA4

  const gaEnv = (env.VITE_GA_MEASUREMENT_ID || '').trim();
  if (gaEnv) return { gaId: GA_RE.test(gaEnv) ? gaEnv : '', gtmId: '' };   // explicit but malformed: load nothing
  return { gaId: mode === 'production' ? DEFAULT_GA_ID : '', gtmId: '' };
}

export function analyticsPlugin(mode, env = {}) {
  const { gaId, gtmId } = resolveAnalytics(mode, env);
  return {
    name: 'tracksy-analytics',
    // run before Vite's own %ENV% replacement so our defaults win when no env var is set
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => ({
        html: html.replaceAll('%VITE_GA_MEASUREMENT_ID%', gaId).replaceAll('%VITE_GTM_ID%', gtmId),
        // the standard Google tag, loaded first so Google's "tag detected" check finds it
        tags: gaId ? [{ tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${gaId}` }, injectTo: 'head-prepend' }] : [],
      }),
    },
  };
}

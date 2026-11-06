import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnalytics, analyticsPlugin, DEFAULT_GA_ID } from './vite-analytics-plugin.mjs';

test('production builds send to Tracksy\'s GA4 stream with no env file (the file is git-ignored)', () => {
  assert.equal(DEFAULT_GA_ID, 'G-TNP5J4QCZL');
  assert.deepEqual(resolveAnalytics('production', {}), { gaId: 'G-TNP5J4QCZL', gtmId: '' });
});

test('development and other modes load nothing unless an id is set', () => {
  assert.deepEqual(resolveAnalytics('development', {}), { gaId: '', gtmId: '' });
  assert.deepEqual(resolveAnalytics('development', { VITE_GA_MEASUREMENT_ID: 'G-TEST123' }), { gaId: 'G-TEST123', gtmId: '' });
});

test('an explicit id wins, and a malformed one disables analytics rather than being injected', () => {
  assert.equal(resolveAnalytics('production', { VITE_GA_MEASUREMENT_ID: 'G-OTHER1' }).gaId, 'G-OTHER1');
  assert.equal(resolveAnalytics('production', { VITE_GA_MEASUREMENT_ID: '"><script>alert(1)</script>' }).gaId, '');
  assert.equal(resolveAnalytics('production', { VITE_GTM_ID: 'nope' }).gaId, 'G-TNP5J4QCZL');
});

test('GTM is opt-in and switches direct GA4 off, so events can never be double-sent', () => {
  assert.deepEqual(resolveAnalytics('production', { VITE_GTM_ID: 'GTM-ABC123' }), { gaId: '', gtmId: 'GTM-ABC123' });
});

test('the plugin fills the placeholders and injects the standard gtag.js tag first (only when there is an id)', () => {
  const html = "var id='%VITE_GA_MEASUREMENT_ID%'; var g='%VITE_GTM_ID%';";
  const prod = analyticsPlugin('production', {}).transformIndexHtml;
  assert.equal(prod.order, 'pre');
  const out = prod.handler(html);
  assert.equal(out.html, "var id='G-TNP5J4QCZL'; var g='';");
  assert.deepEqual(out.tags, [{ tag: 'script', attrs: { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-TNP5J4QCZL' }, injectTo: 'head-prepend' }]);

  const dev = analyticsPlugin('development', {}).transformIndexHtml.handler(html);
  assert.equal(dev.tags.length, 0);
  assert.ok(!dev.html.includes('%VITE_') && !dev.html.includes('G-'));
});

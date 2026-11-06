import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGtmId, gtmHtmlPlugin, DEFAULT_GTM_ID } from './vite-gtm-plugin.mjs';

test('production builds default to the Tracksy container even with no env file (the file is git-ignored)', () => {
  assert.equal(resolveGtmId('production', {}), 'GTM-KMVKKZK8');
  assert.equal(DEFAULT_GTM_ID, 'GTM-KMVKKZK8');
});

test('development and other modes load nothing unless an id is set', () => {
  assert.equal(resolveGtmId('development', {}), '');
  assert.equal(resolveGtmId('staging', {}), '');
  assert.equal(resolveGtmId('development', { VITE_GTM_ID: 'GTM-TEST123' }), 'GTM-TEST123');
});

test('an explicit VITE_GTM_ID wins in production, and a malformed one disables GTM rather than injecting it', () => {
  assert.equal(resolveGtmId('production', { VITE_GTM_ID: 'GTM-OTHER1' }), 'GTM-OTHER1');
  assert.equal(resolveGtmId('production', { VITE_GTM_ID: '"><script>alert(1)</script>' }), '');
});

test('the plugin replaces every placeholder in index.html and runs before Vite\'s own replacement', () => {
  const html = "var id='%VITE_GTM_ID%'; <iframe src=\"https://www.googletagmanager.com/ns.html?id=%VITE_GTM_ID%\">";
  const p = gtmHtmlPlugin('production', {});
  assert.equal(p.transformIndexHtml.order, 'pre');
  const out = p.transformIndexHtml.handler(html);
  assert.ok(!out.includes('%VITE_GTM_ID%'));
  assert.equal(out.match(/GTM-KMVKKZK8/g).length, 2);
  assert.ok(!gtmHtmlPlugin('development', {}).transformIndexHtml.handler(html).includes('GTM-'));
});

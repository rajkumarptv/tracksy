import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildContainer, buildEventsMarkdown, customDimensions, CONTAINER_PUBLIC_ID } from './generate-gtm.mjs';
import { EVENTS, FORBIDDEN_PARAM_NAMES } from '../src/lib/analyticsEvents.js';

const here = dirname(fileURLToPath(import.meta.url));
const v = buildContainer().containerVersion;

test('committed container and docs are up to date with the catalogue (run: node analytics/generate-gtm.mjs)', () => {
  assert.deepEqual(JSON.parse(readFileSync(join(here, 'gtm-container.json'), 'utf8')), buildContainer());
  assert.equal(readFileSync(join(here, 'EVENTS.md'), 'utf8'), buildEventsMarkdown());
});

test('container targets the right GTM container and has the expected structure', () => {
  assert.equal(v.container.publicId, CONTAINER_PUBLIC_ID);
  assert.equal(buildContainer().exportFormatVersion, 2);
  for (const k of ['tag', 'trigger', 'variable']) assert.ok(Array.isArray(v[k]) && v[k].length > 0, k);
});

test('ids and names are unique', () => {
  for (const [list, idKey] of [[v.tag, 'tagId'], [v.trigger, 'triggerId'], [v.variable, 'variableId']]) {
    assert.equal(new Set(list.map(x => x[idKey])).size, list.length, `${idKey} not unique`);
    assert.equal(new Set(list.map(x => x.name)).size, list.length, `${idKey} names not unique`);
  }
});

test('every catalogue event has exactly one GA4 event tag fired by its own custom-event trigger', () => {
  for (const name of Object.keys(EVENTS)) {
    const trigger = v.trigger.find(t => t.name === `CE - ${name}`);
    assert.ok(trigger, `trigger for ${name}`);
    assert.equal(trigger.customEventFilter[0].parameter[1].value, name);
    const tags = v.tag.filter(t => t.type === 'gaawe' && t.firingTriggerId.includes(trigger.triggerId));
    assert.equal(tags.length, 1, `tag for ${name}`);
    const eventName = tags[0].parameter.find(p => p.key === 'eventName').value;
    assert.equal(eventName, EVENTS[name].ga4Name || name);
  }
});

test('page views go to GA4 as page_view, and the config tag does not send its own', () => {
  const pv = v.tag.find(t => t.parameter.some(p => p.key === 'eventName' && p.value === 'page_view'));
  assert.ok(pv);
  const config = v.tag.find(t => t.type === 'gaawc');
  assert.equal(config.parameter.find(p => p.key === 'sendPageView').value, 'false');
  // refires on user_context so user_id and properties update without a reload
  const userTrigger = v.trigger.find(t => t.name === 'CE - user_context');
  assert.ok(config.firingTriggerId.includes(userTrigger.triggerId));
});

test('every referenced variable, trigger and tag exists', () => {
  const varNames = new Set(v.variable.map(x => x.name));
  const triggerIds = new Set(v.trigger.map(x => x.triggerId).concat(['2147479573']));
  const tagNames = new Set(v.tag.map(x => x.name));
  const text = JSON.stringify(v.tag);
  for (const [, name] of text.matchAll(/\{\{([^}]+)\}\}/g)) {
    if (name === '_event') continue;
    assert.ok(varNames.has(name), `missing variable ${name}`);
  }
  for (const t of v.tag) {
    for (const id of t.firingTriggerId) assert.ok(triggerIds.has(id), `${t.name}: missing trigger ${id}`);
    for (const p of t.parameter.filter(p => p.type === 'TAG_REFERENCE')) assert.ok(tagNames.has(p.value), `missing tag ${p.value}`);
  }
});

test('stays within GA4 limits for custom definitions', () => {
  const dims = customDimensions();
  assert.ok(dims.event.length <= 50, `event dimensions ${dims.event.length} > 50`);
  assert.ok(dims.user.length <= 25, `user dimensions ${dims.user.length} > 25`);
  assert.ok(Object.keys(EVENTS).length < 500);
});

test('no data-layer variable or event parameter is a personal-data field', () => {
  const dlvNames = v.variable.filter(x => x.type === 'v').map(x => x.name.replace('DLV - ', ''));
  for (const bad of FORBIDDEN_PARAM_NAMES) assert.ok(!dlvNames.includes(bad), `container reads ${bad}`);
  const sent = JSON.stringify(v.tag).match(/\{\{DLV - ([a-z_]+)\}\}/g) || [];
  assert.ok(sent.length > 0);
  for (const m of sent) assert.ok(!FORBIDDEN_PARAM_NAMES.includes(m.slice(8, -2)), `tag sends ${m}`);
});

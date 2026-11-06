// Generates the importable GTM container (gtm-container.json) and the event reference (EVENTS.md)
// from the same catalogue the app uses, so the tags can never drift from the code.
//
//   node analytics/generate-gtm.mjs          (from the frontend/ folder)
//
// Import it in GTM: Admin -> Import Container -> choose the file -> "New" workspace -> Merge ->
// "Rename conflicting tags, triggers, and variables". Then set the "GA4 Measurement ID" constant.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { EVENTS, PARAMS, USER_PROPS } from '../src/lib/analyticsEvents.js';

export const CONTAINER_PUBLIC_ID = 'GTM-KMVKKZK8';
const INIT_TRIGGER_ID = '2147479573';          // GTM built-in "Initialization - All Pages"
const CONFIG_TAG_NAME = 'GA4 - Configuration';
const MEASUREMENT_VAR = 'GA4 Measurement ID';
const SETTINGS_VAR = 'GA4 Event Settings';

const T = (key, value) => ({ type: 'TEMPLATE', key, value });
const map = (...pairs) => ({ type: 'MAP', map: pairs.map(([k, v]) => T(k, v)) });
const dlv = (name) => `DLV - ${name}`;
const ref = (name) => `{{${name}}}`;
const ga4Name = (event) => EVENTS[event].ga4Name || event;

/** Event parameters actually used by at least one event (these become custom dimensions, except page_*). */
export function usedParams() {
  const set = new Set();
  for (const ev of Object.values(EVENTS)) ev.params.forEach(p => set.add(p));
  return [...set];
}

export const customDimensions = () => ({
  event: usedParams().filter(p => !p.startsWith('page_')).map(p => ({ name: PARAMS[p].label, parameter: p })),
  user: Object.keys(USER_PROPS).filter(p => p !== 'user_id').map(p => ({ name: USER_PROPS[p].label, property: p })),
});

export function buildContainer() {
  const base = { accountId: '0', containerId: '0', fingerprint: '0' };
  let triggerSeq = 10, tagSeq = 100, varSeq = 200;

  // ── Variables ──────────────────────────────────────────────────────────
  const variables = [
    { ...base, variableId: String(varSeq++), name: MEASUREMENT_VAR, type: 'c', parameter: [T('value', 'G-XXXXXXXXXX')] },
  ];
  const dlvNames = [...usedParams(), ...Object.keys(USER_PROPS)];
  for (const p of dlvNames) {
    variables.push({
      ...base, variableId: String(varSeq++), name: dlv(p), type: 'v',
      parameter: [{ type: 'INTEGER', key: 'dataLayerVersion', value: '2' }, { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' }, T('name', p)],
    });
  }
  variables.push({
    ...base, variableId: String(varSeq++), name: SETTINGS_VAR, type: 'gtes',
    parameter: [
      { type: 'LIST', key: 'userProperties', list: ['user_currency', 'user_language', 'platform', 'ui_theme'].map(p => map(['name', p], ['value', ref(dlv(p))])) },
    ],
  });

  // ── Triggers (one custom-event trigger per event, plus user_context) ───
  const triggers = [];
  const triggerIds = {};
  for (const name of [...Object.keys(EVENTS), 'user_context']) {
    const id = String(triggerSeq++);
    triggerIds[name] = id;
    triggers.push({
      ...base, triggerId: id, name: `CE - ${name}`, type: 'CUSTOM_EVENT',
      customEventFilter: [{ type: 'EQUALS', parameter: [T('arg0', '{{_event}}'), T('arg1', name)] }],
    });
  }

  // ── Tags ───────────────────────────────────────────────────────────────
  const tags = [{
    ...base, tagId: String(tagSeq++), name: CONFIG_TAG_NAME, type: 'gaawc',
    parameter: [
      { type: 'BOOLEAN', key: 'sendPageView', value: 'false' },     // page views come from virtual_page_view
      { type: 'BOOLEAN', key: 'enableSendToServerContainer', value: 'false' },
      T('measurementId', ref(MEASUREMENT_VAR)),
      { type: 'LIST', key: 'fieldsToSet', list: [map(['fieldName', 'user_id'], ['value', ref(dlv('user_id'))])] },
    ],
    // Initialisation, and again when the user signs in so user_id and properties are updated without a reload
    firingTriggerId: [INIT_TRIGGER_ID, triggerIds.user_context],
    tagFiringOption: 'ONCE_PER_EVENT',
  }];
  for (const [event, spec] of Object.entries(EVENTS)) {
    tags.push({
      ...base, tagId: String(tagSeq++), name: `GA4 - ${ga4Name(event)}${ga4Name(event) !== event ? ` (${event})` : ''}`, type: 'gaawe',
      parameter: [
        { type: 'BOOLEAN', key: 'sendEcommerceData', value: 'false' },
        T('eventName', ga4Name(event)),
        { type: 'TAG_REFERENCE', key: 'measurementId', value: CONFIG_TAG_NAME },
        T('eventSettingsVariable', ref(SETTINGS_VAR)),
        ...(spec.params.length
          ? [{ type: 'LIST', key: 'eventParameters', list: spec.params.map(p => map(['name', p], ['value', ref(dlv(p))])) }]
          : []),
      ],
      firingTriggerId: [triggerIds[event]],
      tagFiringOption: 'ONCE_PER_EVENT',
    });
  }

  return {
    exportFormatVersion: 2,
    exportTime: '2026-01-01 00:00:00',
    containerVersion: {
      path: 'accounts/0/containers/0/versions/0', accountId: '0', containerId: '0', containerVersionId: '0',
      container: {
        path: 'accounts/0/containers/0', accountId: '0', containerId: '0', name: 'Tracksy',
        publicId: CONTAINER_PUBLIC_ID, usageContext: ['WEB'], fingerprint: '0',
      },
      tag: tags, trigger: triggers, variable: variables, fingerprint: '0',
    },
  };
}

export function buildEventsMarkdown() {
  const dims = customDimensions();
  const rows = Object.entries(EVENTS).map(([name, ev]) => {
    const params = ev.params.length ? ev.params.map(p => `\`${p}\``).join(', ') : '–';
    return `| \`${ga4Name(name)}\`${ga4Name(name) !== name ? ` (data layer: \`${name}\`)` : ''} | ${ev.area} | ${params} | ${ev.key ? 'Yes' : ''} | ${ev.desc} |`;
  });
  const paramRows = usedParams().map(p => {
    const d = PARAMS[p];
    const allowed = d.type === 'enum' ? d.values.map(v => `\`${v}\``).join(', ')
      : d.type === 'bool' ? '`true` / `false`' : d.type === 'int' ? `whole number 0–${d.max}` : 'validated pattern';
    return `| \`${p}\` | ${d.label} | ${allowed} |`;
  });
  return `# Tracksy analytics event reference

_Generated by \`node analytics/generate-gtm.mjs\`. Do not edit by hand: change \`src/lib/analyticsEvents.js\` and regenerate._

## Events (${Object.keys(EVENTS).length})

| GA4 event | Area | Parameters | Key event | What it means |
|---|---|---|---|---|
${rows.join('\n')}

## Parameters

| Parameter | Meaning | Allowed values |
|---|---|---|
${paramRows.join('\n')}

## Custom definitions to register in GA4 (Admin → Custom definitions)

Event-scoped dimensions (${dims.event.length}):

| Dimension name | Event parameter |
|---|---|
${dims.event.map(d => `| ${d.name} | \`${d.parameter}\` |`).join('\n')}

User-scoped dimensions (${dims.user.length}):

| Dimension name | User property |
|---|---|
${dims.user.map(d => `| ${d.name} | \`${d.property}\` |`).join('\n')}
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const here = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(here, 'gtm-container.json'), JSON.stringify(buildContainer(), null, 2) + '\n');
  writeFileSync(join(here, 'EVENTS.md'), buildEventsMarkdown());
  console.log(`Wrote gtm-container.json (${Object.keys(EVENTS).length} events) and EVENTS.md`);
}

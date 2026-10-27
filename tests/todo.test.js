import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTodoSource, parseDue } from '../js/source/todo.js';
import { createTodoTaskConfigStore } from '../js/configStore/todoTask.js';
import { createGraphClient } from '../js/graph/client.js';
import {
  encodeConfigNote, decodeConfigNote, htmlToText, validateConfig, ConfigError, DEFAULT_CONFIG,
} from '../js/configStore/codec.js';
import { CONFIG_TASK_TITLE } from '../js/model/model.js';

// ── Codec ────────────────────────────────────────────────────
test('Konfiguration übersteht Schreiben als Text und Lesen als HTML', () => {
  const config = validateConfig({
    ...structuredClone(DEFAULT_CONFIG),
    areas: [{ id: 'a', name: 'Bereich <A> & „B“', motivation: "Sag's 'so'" }],
  });
  const text = encodeConfigNote(config);
  // So ähnlich liefert To Do die Notiz als HTML zurück
  const html = '<html><head><meta charset="utf-8"></head><body><p>' +
    text.split('\n').map(l => l.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll(' ', '&nbsp;')).join('<br>') +
    '</p></body></html>';
  assert.deepEqual(decodeConfigNote({ contentType: 'html', content: html }), config);
  assert.deepEqual(decodeConfigNote({ contentType: 'text', content: text }), config);
});

test('htmlToText dekodiert Entities und Umbrüche', () => {
  assert.equal(htmlToText('<div>a&#123;b&#x7d;</div><p>c&lt;d</p>'), 'a{b}\nc<d\n');
});

test('Ungültige Konfiguration wirft ConfigError', () => {
  assert.throws(() => decodeConfigNote({ contentType: 'text', content: 'keine Daten' }), ConfigError);
  assert.throws(() => decodeConfigNote({ contentType: 'text', content: '{ "areas": [ }' }), ConfigError);
  assert.throws(() => validateConfig({ areas: {} }), ConfigError);
  assert.throws(() => validateConfig({ defaultMaxTasks: 0 }), ConfigError);
  assert.throws(() => validateConfig({ version: 99 }), /neuer/);
});

test('Fehlende optionale Felder werden ergänzt', () => {
  const c = validateConfig({ areas: [] });
  assert.equal(c.defaultMaxTasks, 5);
  assert.deepEqual(c.lists, {});
  assert.deepEqual(c.tasks, {});
});

// ── Fake-Graph ───────────────────────────────────────────────
function fakeFetch(routes, log = []) {
  return async (url, init) => {
    const u = new URL(url);
    const key = `${init.method} ${decodeURIComponent(u.pathname + u.search)}`;
    log.push({ key, body: init.body && JSON.parse(init.body) });
    const handler = routes.find(([pattern]) => pattern instanceof RegExp ? pattern.test(key) : key === pattern);
    if (!handler) return new Response(JSON.stringify({ error: { code: 'NotFound', message: key } }), { status: 404 });
    const [status, body, headers] = typeof handler[1] === 'function' ? handler[1](init) : handler[1];
    return new Response(body === null ? null : JSON.stringify(body), { status, headers });
  };
}

test('Graph-Client: Seiten folgen, Retry-After bei 429', async () => {
  let calls = 0;
  const graph = createGraphClient(async () => 'tok', fakeFetch([
    ['GET /v1.0/x', () => (++calls === 1 ? [429, {}, { 'Retry-After': '0' }] :
      [200, { value: [1], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/x2' }])],
    ['GET /v1.0/x2', [200, { value: [2] }]],
  ]));
  assert.deepEqual(await graph.getAll('/x'), [1, 2]);
});

test('To-Do-Source: Mapping, Filter und Fallback bei abgelehntem Filter', async () => {
  const log = [];
  const graph = createGraphClient(async () => 'tok', fakeFetch([
    ['GET /v1.0/me/todo/lists', [200, { value: [{ id: 'L1', displayName: 'Eins' }, { id: 'L2', displayName: 'Zwei' }] }]],
    [/^GET \/v1.0\/me\/todo\/lists\/L1\/tasks\?\$top=100&\$filter=status ne 'completed'$/,
      [200, { value: [{ id: 'a', title: 'A', status: 'notStarted', importance: 'high',
        dueDateTime: { dateTime: '2026-10-29T00:00:00.0000000', timeZone: 'UTC' }, categories: ['x'] }] }]],
    [/^GET \/v1.0\/me\/todo\/lists\/L1\/tasks\?\$top=100&\$filter=title eq/,
      [200, { value: [{ id: 'cfg', title: CONFIG_TASK_TITLE, status: 'completed' }] }]],
    [/^GET \/v1.0\/me\/todo\/lists\/L2\/tasks\?\$top=100&\$filter=/,
      [400, { error: { code: 'BadRequest', message: 'filter' } }]],
    ['GET /v1.0/me/todo/lists/L2/tasks?$top=100',
      [200, { value: [{ id: 'b', title: 'B', status: 'inProgress' }, { id: 'c', title: 'C', status: 'completed' }] }]],
  ], log));

  const data = await createTodoSource(graph).load();
  assert.deepEqual(data.lists, [{ id: 'L1', name: 'Eins' }, { id: 'L2', name: 'Zwei' }]);
  assert.deepEqual(data.tasks.map(t => t.id), ['a', 'cfg', 'b']);
  const a = data.tasks[0];
  assert.equal(a.important, true);
  assert.equal(a.due.getDate(), 29);
  assert.deepEqual(a.categories, ['x']);
  assert.equal(data.tasks[1].completed, true);
  assert.ok(log.some(l => l.key.includes(`title eq '${CONFIG_TASK_TITLE}'`)));
});

test('parseDue nimmt nur den Kalendertag', () => {
  const d = parseDue({ dateTime: '2026-12-31T23:00:00.0000000', timeZone: 'UTC' });
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 11, 31]);
  assert.equal(parseDue(undefined), null);
});

test('Config-Store: lädt vor dem Schreiben neu und überschreibt nie eine ungültige Notiz', async () => {
  let note = { contentType: 'text', content: encodeConfigNote(validateConfig({ theme: 'hell', areas: [] })) };
  const log = [];
  const graph = createGraphClient(async () => 'tok', fakeFetch([
    ['GET /v1.0/me/todo/lists/L1/tasks/T1', () => [200, { id: 'T1', body: note }]],
    ['PATCH /v1.0/me/todo/lists/L1/tasks/T1', init => {
      note = JSON.parse(init.body).body;
      return [200, {}];
    }],
  ], log));
  const store = createTodoTaskConfigStore(graph);
  store.use({ listId: 'L1', taskId: 'T1' });

  // Jemand ändert die Notiz zwischendurch – die Änderung bleibt erhalten
  note = { contentType: 'text', content: encodeConfigNote(validateConfig({ theme: 'hell', areas: [{ id: 'x', name: 'X' }] })) };
  const saved = await store.update(c => ({ ...c, theme: 'dunkel' }));
  assert.equal(saved.theme, 'dunkel');
  assert.deepEqual(saved.areas, [{ id: 'x', name: 'X' }]);
  assert.equal((await store.load()).theme, 'dunkel');

  note = { contentType: 'html', content: '<p>kaputt {</p>' };
  const patchesBefore = log.filter(l => l.key.startsWith('PATCH')).length;
  await assert.rejects(store.update(c => c), ConfigError);
  assert.equal(log.filter(l => l.key.startsWith('PATCH')).length, patchesBefore);
});

test('Config-Store: Task anlegen (erledigt, Notiz mit Standardkonfiguration)', async () => {
  const log = [];
  const graph = createGraphClient(async () => 'tok', fakeFetch([
    ['POST /v1.0/me/todo/lists', [201, { id: 'NEW', displayName: 'Sunburst' }]],
    ['POST /v1.0/me/todo/lists/NEW/tasks', [201, { id: 'T9', status: 'completed' }]],
  ], log));
  const store = createTodoTaskConfigStore(graph);
  const list = await store.createList('Sunburst');
  const config = await store.create(list.id);
  const post = log.find(l => l.key === 'POST /v1.0/me/todo/lists/NEW/tasks').body;
  assert.equal(post.title, CONFIG_TASK_TITLE);
  assert.equal(post.status, 'completed');
  assert.deepEqual(decodeConfigNote(post.body), config);
  assert.equal(store.listId, 'NEW');
});

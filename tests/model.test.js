import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isVisibleTask, isoWeekKey, rankTasks, buildView, buildAreaTree, buildTypeTree,
  CONFIG_TASK_TITLE, CATEGORY_HIDDEN, CATEGORY_DELEGATED,
} from '../js/model/model.js';
import { createSampleSource, SAMPLE_CONFIG } from '../js/source/sample.js';

const NOW = new Date(2026, 9, 27, 10, 0);          // Di, 27.10.2026
const day = n => new Date(2026, 9, 27 + n);

function task(id, extra = {}) {
  return { id, listId: 'l1', title: id, completed: false, important: false, due: null, categories: [], ...extra };
}

test('Filter: erledigt, ausgeblendet, delegiert und Konfigurations-Task fallen weg', () => {
  assert.equal(isVisibleTask(task('a')), true);
  assert.equal(isVisibleTask(task('b', { completed: true })), false);
  assert.equal(isVisibleTask(task('c', { categories: [CATEGORY_HIDDEN] })), false);
  assert.equal(isVisibleTask(task('d', { categories: [CATEGORY_DELEGATED] })), false);
  assert.equal(isVisibleTask(task('e', { title: CONFIG_TASK_TITLE })), false);
});

test('ISO-Woche', () => {
  assert.equal(isoWeekKey(new Date(2026, 9, 27)), '2026-W44');
  assert.equal(isoWeekKey(new Date(2027, 0, 1)), '2026-W53');   // Fr, gehört zur letzten Woche 2026
  assert.equal(isoWeekKey(new Date(2025, 11, 29)), '2026-W01');
});

test('Kaskade: fällig (nach Datum) vor wichtig vor Rest; Fälligkeit nach 7 Tagen zählt nicht', () => {
  const tasks = [
    task('rest1'), task('wichtig', { important: true }),
    task('spaet', { due: day(8) }), task('bald', { due: day(5) }),
    task('ueberfaellig', { due: day(-2) }), task('tag7', { due: day(7) }),
  ];
  const ids = rankTasks(tasks, { now: NOW, listId: 'l1' }).map(t => t.id);
  assert.deepEqual(ids.slice(0, 4), ['ueberfaellig', 'bald', 'tag7', 'wichtig']);
  assert.deepEqual(new Set(ids.slice(4)), new Set(['rest1', 'spaet']));
});

test('Zufall ist innerhalb einer Woche stabil und unabhängig von der Eingabereihenfolge', () => {
  const tasks = Array.from({ length: 12 }, (_, i) => task(`t${i}`));
  const a = rankTasks(tasks, { now: NOW, listId: 'l1' }).map(t => t.id);
  const b = rankTasks([...tasks].reverse(), { now: new Date(2026, 10, 1), listId: 'l1' }).map(t => t.id);
  assert.deepEqual(a, b);
  const nextWeek = rankTasks(tasks, { now: new Date(2026, 10, 3), listId: 'l1' }).map(t => t.id);
  assert.notDeepEqual(a, nextWeek);
});

test('Beispieldaten: maxTasks, „+N weitere“, Aufklappen und Listen ohne Bereich', async () => {
  const data = await createSampleSource().load();
  const view = buildView(data, SAMPLE_CONFIG, { now: NOW });
  const lists = view.areas.flatMap(a => a.lists);
  const weiterbildung = lists.find(l => l.list.id === 'list-weiterbildung');
  assert.equal(weiterbildung.tasks.length, 5);
  assert.equal(weiterbildung.hiddenCount, 3);           // 8 offen, 1 erledigt

  const kunde = lists.find(l => l.list.id === 'list-kundenprojekt');
  assert.equal(kunde.tasks.length, 3);                   // maxTasks 3, delegiert fällt weg
  assert.equal(kunde.hiddenCount, 0);

  assert.deepEqual(view.unassignedLists.map(l => l.id).sort(), ['list-ideen', 'list-reisen']);

  const tree = buildAreaTree(view, SAMPLE_CONFIG);
  const wbNode = tree.children[0].children.find(n => n.listId === 'list-weiterbildung');
  assert.equal(wbNode.children.at(-1).kind, 'more');
  assert.equal(wbNode.children.at(-1).name, '+3 weitere');

  const kochen = tree.children.find(n => n.name === 'Gesundheit').children.find(n => n.listId === 'list-kochen');
  assert.equal(kochen.value, 1);                          // leere Aktivität bleibt sichtbar
  assert.equal(kochen.children, undefined);

  const expanded = buildView(data, SAMPLE_CONFIG, { now: NOW, expanded: new Set(['list-weiterbildung']) });
  const wbExpanded = expanded.areas[0].lists.find(l => l.list.id === 'list-weiterbildung');
  assert.equal(wbExpanded.tasks.length, 8);
  assert.ok(!buildAreaTree(expanded, SAMPLE_CONFIG).children[0].children[0].children.some(n => n.kind === 'more'));
});

test('Typ-Ansicht: Gruppierung nach Konfiguration, „Sonstige“ zuletzt', async () => {
  const data = await createSampleSource().load();
  const view = buildView(data, SAMPLE_CONFIG, { now: NOW });
  const tree = buildTypeTree(view, SAMPLE_CONFIG);
  assert.equal(tree.children.at(-1).name, 'Sonstige');
  assert.equal(tree.children.at(-1).colorIndex, null);
  const shown = view.areas.flatMap(a => a.lists).reduce((n, l) => n + l.tasks.length, 0);
  const inTree = tree.children.reduce((n, t) => n + t.children.length, 0);
  assert.equal(inTree, shown);
  const sonstige = tree.children.at(-1).children.map(c => c.taskId);
  assert.ok(sonstige.every(id => !SAMPLE_CONFIG.tasks[id]?.type));
});

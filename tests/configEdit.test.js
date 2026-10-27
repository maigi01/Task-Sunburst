import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addArea, removeArea, addTaskType, removeTaskType, moveItem, setListField, setTaskField,
  findOrphans, countOrphans, removeOrphans,
} from '../js/model/configEdit.js';
import { validateConfig } from '../js/configStore/codec.js';
import { CONFIG_TASK_TITLE } from '../js/model/model.js';
import { stableStringify } from '../js/settings/settingsView.js';

const draft = () => validateConfig({
  areas: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  taskTypes: [{ id: 'x', name: 'X' }],
  lists: { L1: { area: 'a', motivation: 'm' }, L2: { area: 'b' } },
  tasks: { t1: { type: 'x', motivation: 'mm' }, t2: { type: 'x' } },
});

test('Bereich anlegen bekommt eindeutige id; löschen hebt Zuordnung auf und räumt leere Einträge weg', () => {
  const d = draft();
  const area = addArea(d);
  assert.match(area.id, /^bereich-/);
  assert.equal(new Set(d.areas.map(a => a.id)).size, 3);
  removeArea(d, 'b');
  assert.deepEqual(d.lists, { L1: { area: 'a', motivation: 'm' } });   // L2 war nur Zuordnung → weg
  removeArea(d, 'a');
  assert.deepEqual(d.lists, { L1: { motivation: 'm' } });
});

test('Typ löschen setzt Tasks auf Sonstige, Motivation bleibt', () => {
  const d = draft();
  addTaskType(d, 'Y');
  removeTaskType(d, 'x');
  assert.deepEqual(d.tasks, { t1: { motivation: 'mm' } });
  assert.deepEqual(d.taskTypes.map(t => t.name), ['Y']);
});

test('Felder setzen und leeren', () => {
  const d = draft();
  setListField(d, 'L3', 'maxTasks', 4);
  assert.deepEqual(d.lists.L3, { maxTasks: 4 });
  setListField(d, 'L3', 'maxTasks', undefined);
  assert.equal('L3' in d.lists, false);
  setTaskField(d, 't3', 'motivation', '');
  assert.equal('t3' in d.tasks, false);
});

test('Reihenfolge ändern, Grenzen werden ignoriert', () => {
  const items = [1, 2, 3];
  moveItem(items, 0, -1);
  moveItem(items, 2, 1);
  assert.deepEqual(items, [1, 2, 3]);
  moveItem(items, 0, 1);
  assert.deepEqual(items, [2, 1, 3]);
});

test('Verwaiste Einträge finden und entfernen', () => {
  const d = draft();
  d.lists.GONE = { area: 'a' };
  d.lists.L2.area = 'deleted-area';
  d.tasks.t2.type = 'deleted-type';
  const data = {
    lists: [{ id: 'L1' }, { id: 'L2' }],
    tasks: [
      { id: 't1', completed: false, title: 'eins' },
      { id: 't2', completed: false, title: 'zwei' },
      { id: 'cfg', completed: true, title: CONFIG_TASK_TITLE },
    ],
  };
  d.tasks.done = { type: 'x' };   // erledigt/gelöscht → nicht in data
  const o = findOrphans(d, data);
  assert.deepEqual(o, { lists: ['GONE'], tasks: ['done'], listAreaRefs: ['L2'], taskTypeRefs: ['t2'] });
  assert.equal(countOrphans(o), 4);
  removeOrphans(d, data);
  assert.equal(countOrphans(findOrphans(d, data)), 0);
  assert.deepEqual(d.lists, { L1: { area: 'a', motivation: 'm' } });
  assert.deepEqual(d.tasks, { t1: { type: 'x', motivation: 'mm' } });
});

test('stableStringify ignoriert die Reihenfolge der Schlüssel', () => {
  assert.equal(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] }), stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }));
  assert.notEqual(stableStringify({ a: [1, 2] }), stableStringify({ a: [2, 1] }));
});

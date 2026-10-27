// ═══════════════════════════════════════════════════════════════
//  SOURCE: Microsoft To Do  –  Adapter Graph-API → neutrales Datenmodell
//
//  Pro Liste werden geladen:
//    - offene Tasks (status ne 'completed')
//    - der Konfigurations-Task, auch wenn er erledigt ist (Suche nach Titel)
//  Erledigte Tasks werden sonst nicht geladen, damit lange Historien nicht
//  bremsen. Falls die API einen Filter ablehnt, wird die Liste ungefiltert
//  geladen und lokal gefiltert.
// ═══════════════════════════════════════════════════════════════

import { CONFIG_TASK_TITLE } from '../model/model.js';

const PARALLEL_LISTS = 4;
const PAGE_SIZE = 100;

const odataString = s => `'${s.replaceAll("'", "''")}'`;
const tasksPath = (listId, filter) =>
  `/me/todo/lists/${encodeURIComponent(listId)}/tasks?$top=${PAGE_SIZE}` +
  (filter ? `&$filter=${encodeURIComponent(filter)}` : '');

// dueDateTime ist ein Datum ohne echte Uhrzeit → nur den Kalendertag übernehmen
export function parseDue(dueDateTime) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDateTime?.dateTime ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function toNeutralTask(t, listId) {
  return {
    id: t.id,
    listId,
    title: t.title ?? '',
    completed: t.status === 'completed',
    important: t.importance === 'high',
    due: parseDue(t.dueDateTime),
    categories: t.categories ?? [],
  };
}

async function loadListTasks(graph, listId) {
  try {
    const [open, config] = await Promise.all([
      graph.getAll(tasksPath(listId, "status ne 'completed'")),
      graph.getAll(tasksPath(listId, `title eq ${odataString(CONFIG_TASK_TITLE)}`)),
    ]);
    const seen = new Set(open.map(t => t.id));
    return [...open, ...config.filter(t => !seen.has(t.id))];
  } catch (err) {
    if (err.status !== 400) throw err;
    const all = await graph.getAll(tasksPath(listId));
    return all.filter(t => t.status !== 'completed' || t.title === CONFIG_TASK_TITLE);
  }
}

async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function createTodoSource(graph) {
  return {
    kind: 'todo',
    async load() {
      const rawLists = await graph.getAll('/me/todo/lists');
      const lists = rawLists.map(l => ({ id: l.id, name: l.displayName ?? '' }));
      const perList = await mapLimited(lists, PARALLEL_LISTS, list => loadListTasks(graph, list.id));
      const tasks = perList.flatMap((raw, i) => raw.map(t => toNeutralTask(t, lists[i].id)));
      return { lists, tasks };
    },
  };
}

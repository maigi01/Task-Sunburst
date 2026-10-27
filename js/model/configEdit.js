// ═══════════════════════════════════════════════════════════════
//  KONFIGURATION BEARBEITEN  –  reine Funktionen für die Einstellungsansicht
//
//  Alle Funktionen ändern den übergebenen Entwurf direkt (draft) und
//  halten ihn klein: leere Einträge unter `lists` und `tasks` werden entfernt.
// ═══════════════════════════════════════════════════════════════

import { CONFIG_TASK_TITLE } from './model.js';

export function newId(prefix, existing) {
  const taken = new Set(existing.map(e => e.id));
  for (;;) {
    const id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.has(id)) return id;
  }
}

export function moveItem(items, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
}

// ── Bereiche ─────────────────────────────────────────────────
export function addArea(draft, name = 'Neuer Bereich') {
  const area = { id: newId('bereich', draft.areas), name, motivation: '' };
  draft.areas.push(area);
  return area;
}

export function listsInArea(draft, areaId) {
  return Object.keys(draft.lists).filter(id => draft.lists[id].area === areaId);
}

// Listen des Bereichs verlieren ihre Zuordnung
export function removeArea(draft, areaId) {
  draft.areas = draft.areas.filter(a => a.id !== areaId);
  for (const listId of listsInArea(draft, areaId)) setListField(draft, listId, 'area', undefined);
}

// ── Aufgabentypen ────────────────────────────────────────────
export function addTaskType(draft, name = 'Neuer Typ') {
  const type = { id: newId('typ', draft.taskTypes), name };
  draft.taskTypes.push(type);
  return type;
}

export function tasksWithType(draft, typeId) {
  return Object.keys(draft.tasks).filter(id => draft.tasks[id].type === typeId);
}

// Betroffene Tasks fallen auf „Sonstige“ zurück
export function removeTaskType(draft, typeId) {
  draft.taskTypes = draft.taskTypes.filter(t => t.id !== typeId);
  for (const taskId of tasksWithType(draft, typeId)) setTaskField(draft, taskId, 'type', undefined);
}

// ── Listen und Tasks ─────────────────────────────────────────
function setEntryField(map, key, field, value) {
  const entry = { ...(map[key] ?? {}) };
  if (value === undefined || value === '' || value === null) delete entry[field];
  else entry[field] = value;
  if (Object.keys(entry).length === 0) delete map[key];
  else map[key] = entry;
}

export function setListField(draft, listId, field, value) {
  setEntryField(draft.lists, listId, field, value);
}

export function setTaskField(draft, taskId, field, value) {
  setEntryField(draft.tasks, taskId, field, value);
}

// ── Verwaiste Einträge ───────────────────────────────────────
//  data enthält nur offene Tasks (und den Konfigurations-Task). Einträge zu
//  gelöschten oder erledigten Tasks gelten deshalb beide als verwaist.
export function findOrphans(draft, data) {
  const listIds = new Set(data.lists.map(l => l.id));
  const openTaskIds = new Set(data.tasks.filter(t => !t.completed && t.title !== CONFIG_TASK_TITLE).map(t => t.id));
  const areaIds = new Set(draft.areas.map(a => a.id));
  const typeIds = new Set(draft.taskTypes.map(t => t.id));
  return {
    lists: Object.keys(draft.lists).filter(id => !listIds.has(id)),
    tasks: Object.keys(draft.tasks).filter(id => !openTaskIds.has(id)),
    // Verweise auf nicht (mehr) vorhandene Bereiche bzw. Typen
    listAreaRefs: Object.keys(draft.lists).filter(id => draft.lists[id].area && !areaIds.has(draft.lists[id].area)),
    taskTypeRefs: Object.keys(draft.tasks).filter(id => draft.tasks[id].type && !typeIds.has(draft.tasks[id].type)),
  };
}

export function countOrphans(orphans) {
  return orphans.lists.length + orphans.tasks.length + orphans.listAreaRefs.length + orphans.taskTypeRefs.length;
}

export function removeOrphans(draft, data) {
  const o = findOrphans(draft, data);
  for (const id of o.lists) delete draft.lists[id];
  for (const id of o.tasks) delete draft.tasks[id];
  for (const id of o.listAreaRefs) if (draft.lists[id]) setListField(draft, id, 'area', undefined);
  for (const id of o.taskTypeRefs) if (draft.tasks[id]) setTaskField(draft, id, 'type', undefined);
}

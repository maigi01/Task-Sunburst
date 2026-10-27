// ═══════════════════════════════════════════════════════════════
//  MODEL  –  Filtern, Sortieren, Aufbau der Hierarchie
//
//  Arbeitet nur mit dem neutralen Datenmodell der Source-Schicht:
//    List { id, name }
//    Task { id, listId, title, completed, important, due (Date|null), categories [] }
//  Keine Abhängigkeit zu D3, DOM oder Graph-API.
// ═══════════════════════════════════════════════════════════════

export const CONFIG_TASK_TITLE  = '⚙ Sunburst-Konfiguration';
export const CATEGORY_HIDDEN    = 'Sunburst: aus';
export const CATEGORY_DELEGATED = 'delegiert';
export const OTHER_TYPE         = { id: '_sonstige', name: 'Sonstige' };

const DUE_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Filter ───────────────────────────────────────────────────
export function isVisibleTask(task) {
  return !task.completed
    && task.title !== CONFIG_TASK_TITLE
    && !task.categories.includes(CATEGORY_HIDDEN)
    && !task.categories.includes(CATEGORY_DELEGATED);
}

// ── Kalenderwoche und Zufall mit festem Startwert ────────────
export function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);          // Donnerstag der Woche
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function hashString(str) {                               // FNV-1a, 32 bit
  let h = 0x811c9dc5;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(items, rng) {
  // Erst nach id sortieren, damit das Ergebnis nicht von der API-Reihenfolge abhängt
  const out = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Sortierung (Kaskade) ─────────────────────────────────────
//  1. fällig bis Ende des 7. Tages ab heute (Überfälliges inklusive), nach Datum
//  2. wichtig
//  3. Rest
//  Gruppen 2 und 3 werden mit Startwert ISO-Woche + Listen-ID gemischt,
//  damit die Auswahl eine Woche lang stabil bleibt.
export function rankTasks(tasks, { now, listId }) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = today.getTime() + (DUE_WINDOW_DAYS + 1) * DAY_MS;

  const dueSoon = [], important = [], rest = [];
  for (const t of tasks) {
    if (t.due && t.due.getTime() < limit) dueSoon.push(t);
    else if (t.important) important.push(t);
    else rest.push(t);
  }
  dueSoon.sort((a, b) => a.due - b.due || a.title.localeCompare(b.title, 'de'));

  const rng = mulberry32(hashString(`${isoWeekKey(now)}:${listId}`));
  return [...dueSoon, ...seededShuffle(important, rng), ...seededShuffle(rest, rng)];
}

// ── Konfiguration abfragen ───────────────────────────────────
export function taskTypeOf(config, taskId) {
  const typeId = config.tasks?.[taskId]?.type;
  return config.taskTypes.find(t => t.id === typeId) ?? OTHER_TYPE;
}

export function taskMotivation(config, taskId) {
  return config.tasks?.[taskId]?.motivation ?? '';
}

// ── Sicht: was wird angezeigt? ───────────────────────────────
//  expanded: Set von Listen-IDs, die vorübergehend alle Tasks zeigen
export function buildView(data, config, { now = new Date(), expanded = new Set() } = {}) {
  const visibleByList = new Map();
  for (const t of data.tasks.filter(isVisibleTask)) {
    if (!visibleByList.has(t.listId)) visibleByList.set(t.listId, []);
    visibleByList.get(t.listId).push(t);
  }
  const configListIds = new Set(
    data.tasks.filter(t => t.title === CONFIG_TASK_TITLE).map(t => t.listId)
  );

  const groups = config.areas.map(area => ({ area, lists: [] }));
  const groupByAreaId = new Map(groups.map(g => [g.area.id, g]));
  const unassignedLists = [];

  for (const list of data.lists) {
    const visible = visibleByList.get(list.id) ?? [];
    // Die Liste des Konfigurations-Tasks nur, wenn sie weitere Tasks enthält
    if (configListIds.has(list.id) && visible.length === 0) continue;

    const entry = config.lists?.[list.id];
    const group = entry && groupByAreaId.get(entry.area);
    if (!group) {
      unassignedLists.push(list);
      continue;
    }

    const maxTasks = entry.maxTasks ?? config.defaultMaxTasks;
    const ranked = rankTasks(visible, { now, listId: list.id });
    const isExpanded = expanded.has(list.id);
    group.lists.push({
      list,
      motivation: entry.motivation ?? '',
      tasks: isExpanded ? ranked : ranked.slice(0, maxTasks),
      hiddenCount: Math.max(0, ranked.length - maxTasks),
      expanded: isExpanded,
    });
  }

  return { areas: groups.filter(g => g.lists.length > 0), unassignedLists };
}

// ── Hierarchien für das Sunburst ─────────────────────────────
//  colorIndex verweist auf die Palette des Themes (null = neutral); das Model kennt keine Farben.
function taskNode(task, config, area, entry) {
  return {
    kind: 'task',
    name: task.title,
    taskId: task.id,
    listId: task.listId,
    typeName: taskTypeOf(config, task.id).name,
    motivation: taskMotivation(config, task.id),
    areaName: area.name,
    listName: entry.list.name,
    due: task.due,
    important: task.important,
    value: 1,
  };
}

export function buildAreaTree(view, config) {
  return {
    name: 'root',
    children: view.areas.map(({ area, lists }) => ({
      kind: 'area',
      name: area.name,
      motivation: area.motivation ?? '',
      colorIndex: config.areas.indexOf(area),
      children: lists.map(entry => {
        const node = {
          kind: 'list',
          name: entry.list.name,
          listId: entry.list.id,
          motivation: entry.motivation,
          hiddenCount: entry.hiddenCount,
          expanded: entry.expanded,
          taskCount: entry.tasks.length + (entry.expanded ? 0 : entry.hiddenCount),
        };
        const children = entry.tasks.map(t => taskNode(t, config, area, entry));
        if (!entry.expanded && entry.hiddenCount > 0) {
          children.push({
            kind: 'more',
            name: `+${entry.hiddenCount} weitere`,
            listId: entry.list.id,
            hiddenCount: entry.hiddenCount,
            value: 1,
          });
        }
        // Aktivität ohne sichtbare Aufgaben → eigenes Segment mit Gewicht 1
        if (children.length === 0) node.value = 1;
        else node.children = children;
        return node;
      }),
    })),
  };
}

export function buildTypeTree(view, config) {
  const types = [...config.taskTypes, OTHER_TYPE];
  const byType = new Map(types.map(t => [t.id, []]));
  for (const { area, lists } of view.areas) {
    for (const entry of lists) {
      for (const task of entry.tasks) {
        byType.get(taskTypeOf(config, task.id).id).push(taskNode(task, config, area, entry));
      }
    }
  }
  return {
    name: 'root',
    children: types
      .map((type, i) => ({
        kind: 'type',
        name: type.name,
        colorIndex: type === OTHER_TYPE ? null : i,      // null → neutrale Farbe des Themes
        children: byType.get(type.id),
      }))
      .filter(node => node.children.length > 0),
  };
}

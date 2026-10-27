// ═══════════════════════════════════════════════════════════════
//  CONFIG STORE: To-Do-Task  –  JSON in der Notiz von „⚙ Sunburst-Konfiguration“
//
//  Ablauf: findCandidates() → use() bzw. create() → load() / update()
//  update() lädt vor dem Schreiben immer die aktuelle Version neu.
//  Ist die gespeicherte Konfiguration ungültig, wird nie geschrieben.
// ═══════════════════════════════════════════════════════════════

import { CONFIG_TASK_TITLE } from '../model/model.js';
import { DEFAULT_CONFIG, encodeConfigNote, decodeConfigNote, validateConfig } from './codec.js';

const enc = encodeURIComponent;
const noteBody = config => ({ contentType: 'text', content: encodeConfigNote(config) });

export function createTodoTaskConfigStore(graph) {
  let location = null;   // { listId, taskId }

  const taskPath = () => {
    if (!location) throw new Error('Kein Konfigurations-Task ausgewählt.');
    return `/me/todo/lists/${enc(location.listId)}/tasks/${enc(location.taskId)}`;
  };

  async function load() {
    const task = await graph.get(taskPath());
    return decodeConfigNote(task.body);
  }

  return {
    kind: 'todoTask',

    get listId() {
      return location?.listId ?? null;
    },

    findCandidates(data) {
      const listNames = new Map(data.lists.map(l => [l.id, l.name]));
      return data.tasks
        .filter(t => t.title === CONFIG_TASK_TITLE)
        .map(t => ({ taskId: t.id, listId: t.listId, listName: listNames.get(t.listId) ?? '?' }));
    },

    use(candidate) {
      location = { listId: candidate.listId, taskId: candidate.taskId };
    },

    load,

    async update(change) {
      const next = validateConfig(change(await load()));
      await graph.patch(taskPath(), { body: noteBody(next) });
      return next;
    },

    async createList(name) {
      const list = await graph.post('/me/todo/lists', { displayName: name });
      return { id: list.id, name: list.displayName };
    },

    async create(listId, config = DEFAULT_CONFIG) {
      const valid = validateConfig(structuredClone(config));
      const task = await graph.post(`/me/todo/lists/${enc(listId)}/tasks`, {
        title: CONFIG_TASK_TITLE,
        status: 'completed',
        body: noteBody(valid),
      });
      location = { listId, taskId: task.id };
      if (task.status !== 'completed') await graph.patch(taskPath(), { status: 'completed' });
      return valid;
    },
  };
}

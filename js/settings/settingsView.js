// ═══════════════════════════════════════════════════════════════
//  EINSTELLUNGEN  –  Bearbeiten der Konfiguration
//
//  Gearbeitet wird auf einem Entwurf. Erst „Speichern“ schreibt ihn über
//  den Config-Store zurück (der vorher die aktuelle Version neu lädt).
// ═══════════════════════════════════════════════════════════════

import { isVisibleTask, OTHER_TYPE } from '../model/model.js';
import {
  addArea, removeArea, listsInArea, addTaskType, removeTaskType, tasksWithType,
  moveItem, setListField, setTaskField, findOrphans, countOrphans, removeOrphans,
} from '../model/configEdit.js';

const TABS = [
  { id: 'areas', label: 'Bereiche' },
  { id: 'lists', label: 'Listen' },
  { id: 'types', label: 'Aufgabentypen' },
  { id: 'tasks', label: 'Aufgaben' },
  { id: 'display', label: 'Darstellung' },
  { id: 'cleanup', label: 'Aufräumen' },
];

// Kleiner DOM-Helfer: h('div', { class: 'x', onclick: fn }, 'Text', kind, …)
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key in el && key !== 'list') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
  return el;
}

// Vergleich unabhängig von der Reihenfolge der Schlüssel
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function createSettingsView(root, { themes, onSave, onClose }) {
  let data = null;
  let base = null;
  let draft = null;
  let tab = 'areas';
  let taskFilter = '';
  let saving = false;

  const isDirty = () => stableStringify(draft) !== stableStringify(base);

  function changed(rerender = false) {
    if (rerender) render();
    else updateToolbar();
  }

  // ── Kopf mit Speichern / Abbrechen ─────────────────────────
  function updateToolbar() {
    const dirty = isDirty();
    root.querySelector('.settings-status').textContent = saving
      ? 'Speichere …'
      : dirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert';
    root.querySelector('.settings-status').classList.toggle('dirty', dirty);
    root.querySelector('.settings-save').disabled = !dirty || saving;
  }

  function toolbar() {
    return h('div', { class: 'settings-toolbar' },
      h('h2', {}, 'Einstellungen'),
      h('span', { class: 'settings-status' }),
      h('div', { class: 'settings-actions' },
        h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Zurück zum Diagramm'),
        h('button', { type: 'button', class: 'btn primary settings-save', onclick: save }, 'Speichern'),
      ),
    );
  }

  function tabs() {
    const orphanCount = countOrphans(findOrphans(draft, data));
    return h('nav', { class: 'settings-tabs', role: 'tablist' },
      TABS.map(t => h('button', {
        type: 'button',
        role: 'tab',
        class: t.id === tab ? 'active' : '',
        'aria-selected': String(t.id === tab),
        onclick: () => { tab = t.id; render(); },
      }, t.label, t.id === 'cleanup' && orphanCount > 0 ? h('span', { class: 'tab-count' }, String(orphanCount)) : null)),
    );
  }

  // ── Wiederkehrende Bausteine ───────────────────────────────
  const textInput = (value, placeholder, oninput, cls = '') =>
    h('input', { type: 'text', class: `field ${cls}`, value: value ?? '', placeholder, oninput: e => oninput(e.target.value) });

  const moveButtons = (items, index) => h('span', { class: 'move' },
    h('button', { type: 'button', class: 'icon-btn', title: 'Nach oben', disabled: index === 0,
      onclick: () => { moveItem(items, index, -1); changed(true); } }, '▲'),
    h('button', { type: 'button', class: 'icon-btn', title: 'Nach unten', disabled: index === items.length - 1,
      onclick: () => { moveItem(items, index, 1); changed(true); } }, '▼'),
  );

  const deleteButton = (title, onclick) =>
    h('button', { type: 'button', class: 'icon-btn danger', title, 'aria-label': title, onclick }, '✕');

  const hint = text => h('p', { class: 'settings-hint' }, text);

  const listName = id => data.lists.find(l => l.id === id)?.name;

  // ── Bereiche ───────────────────────────────────────────────
  function areasTab() {
    return [
      hint('Bereiche bilden den inneren Ring. Die Reihenfolge hier bestimmt die Reihenfolge im Diagramm und die Farbe.'),
      h('div', { class: 'rows' },
        draft.areas.length === 0 ? h('p', { class: 'empty' }, 'Noch keine Bereiche.') : null,
        draft.areas.map((area, i) => {
          const count = listsInArea(draft, area.id).filter(id => listName(id)).length;
          return h('div', { class: 'row row-area' },
            moveButtons(draft.areas, i),
            textInput(area.name, 'Name', v => { area.name = v; changed(); }, 'strong'),
            textInput(area.motivation, 'Motivation (optional)', v => { area.motivation = v; changed(); }, 'motivation'),
            h('span', { class: 'meta' }, plural(count, 'Liste', 'Listen')),
            deleteButton(`Bereich „${area.name}“ löschen`, () => {
              const assigned = listsInArea(draft, area.id).length;
              if (assigned > 0 && !confirm(`Bereich „${area.name}“ löschen? ${plural(assigned, 'Liste verliert', 'Listen verlieren')} die Zuordnung.`)) return;
              removeArea(draft, area.id);
              changed(true);
            }),
          );
        }),
      ),
      h('button', { type: 'button', class: 'btn', onclick: () => {
        addArea(draft);
        changed(true);
        root.querySelector('.row-area:last-child .field')?.select();
      } }, '+ Bereich hinzufügen'),
    ];
  }

  // ── Listen ─────────────────────────────────────────────────
  function listsTab() {
    const areaOptions = () => [
      new Option('— kein Bereich —', ''),
      ...draft.areas.map(a => new Option(a.name || '(ohne Namen)', a.id)),
    ];
    return [
      hint('Jede To-Do-Liste ist eine Aktivität im mittleren Ring. Listen ohne Bereich erscheinen nicht im Diagramm.'),
      (() => {
        const n = data.lists.filter(l => !draft.areas.some(a => a.id === draft.lists[l.id]?.area)).length;
        return n ? h('p', { class: 'unassigned-count' }, `${plural(n, 'Liste', 'Listen')} ohne Bereich`) : null;
      })(),
      h('label', { class: 'inline-field' },
        'Standard: höchstens ',
        h('input', { type: 'number', class: 'field num', min: 1, value: draft.defaultMaxTasks,
          oninput: e => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n > 0) { draft.defaultMaxTasks = n; changed(); }
          } }),
        ' Aufgaben pro Liste anzeigen',
      ),
      draft.areas.length === 0
        ? hint('Lege zuerst unter „Bereiche“ mindestens einen Bereich an.')
        : null,
      h('div', { class: 'rows' },
        h('div', { class: 'row row-list row-head' },
          h('span', {}, 'Liste'), h('span', {}, 'Bereich'), h('span', {}, 'Max.'), h('span', {}, 'Motivation')),
        data.lists.map(list => {
          const entry = draft.lists[list.id] ?? {};
          const select = h('select', { class: 'field', onchange: e => { setListField(draft, list.id, 'area', e.target.value || undefined); changed(true); } },
            areaOptions());
          select.value = entry.area && draft.areas.some(a => a.id === entry.area) ? entry.area : '';
          return h('div', { class: `row row-list${select.value ? '' : ' unassigned'}` },
            h('span', { class: 'name' }, list.name),
            select,
            h('input', { type: 'number', class: 'field num', min: 1, value: entry.maxTasks ?? '', placeholder: String(draft.defaultMaxTasks),
              title: 'Leer = Standardwert',
              oninput: e => {
                const n = Number(e.target.value);
                setListField(draft, list.id, 'maxTasks', e.target.value === '' || !(Number.isInteger(n) && n > 0) ? undefined : n);
                changed();
              } }),
            textInput(entry.motivation, 'Motivation (optional)', v => { setListField(draft, list.id, 'motivation', v); changed(); }, 'motivation'),
          );
        }),
      ),
    ];
  }

  // ── Aufgabentypen ──────────────────────────────────────────
  function typesTab() {
    return [
      hint(`Aufgabentypen bilden den inneren Ring der Typ-Ansicht. Aufgaben ohne Typ landen unter „${OTHER_TYPE.name}“.`),
      h('div', { class: 'rows' },
        draft.taskTypes.map((type, i) => {
          const count = tasksWithType(draft, type.id).length;
          return h('div', { class: 'row row-type' },
            moveButtons(draft.taskTypes, i),
            textInput(type.name, 'Name', v => { type.name = v; changed(); }, 'strong'),
            h('span', { class: 'meta' }, plural(count, 'Aufgabe', 'Aufgaben')),
            deleteButton(`Typ „${type.name}“ löschen`, () => {
              if (count > 0 && !confirm(`Typ „${type.name}“ ist ${plural(count, 'Aufgabe', 'Aufgaben')} zugeordnet. Diese auf „${OTHER_TYPE.name}“ setzen und den Typ löschen?`)) return;
              removeTaskType(draft, type.id);
              changed(true);
            }),
          );
        }),
      ),
      h('button', { type: 'button', class: 'btn', onclick: () => {
        addTaskType(draft);
        changed(true);
        root.querySelector('.row-type:last-child .field')?.select();
      } }, '+ Typ hinzufügen'),
    ];
  }

  // ── Aufgaben ───────────────────────────────────────────────
  function tasksTab() {
    const typeOptions = () => [
      new Option(`— ${OTHER_TYPE.name} —`, ''),
      ...draft.taskTypes.map(t => new Option(t.name || '(ohne Namen)', t.id)),
    ];
    const visible = data.tasks.filter(isVisibleTask);
    const groups = draft.areas.map(area => ({
      area,
      lists: data.lists
        .filter(l => draft.lists[l.id]?.area === area.id)
        .map(list => ({
          list,
          tasks: visible.filter(t => t.listId === list.id).sort((a, b) => a.title.localeCompare(b.title, 'de')),
        }))
        .filter(g => g.tasks.length > 0),
    })).filter(g => g.lists.length > 0);

    const container = h('div', { class: 'task-groups' });

    function fill() {
      const f = taskFilter.trim().toLowerCase();
      container.replaceChildren(...groups.map(({ area, lists }) => {
        const listEls = lists.map(({ list, tasks }) => {
          const shown = f ? tasks.filter(t => t.title.toLowerCase().includes(f)) : tasks;
          if (shown.length === 0) return null;
          const meta = h('span', { class: 'meta' });
          const updateMeta = () => {
            meta.textContent = ` ${tasks.filter(t => draft.tasks[t.id]?.type).length}/${tasks.length} mit Typ`;
          };
          updateMeta();
          return h('details', { class: 'task-list', open: Boolean(f) },
            h('summary', {}, list.name, meta),
            shown.map(task => {
              const entry = draft.tasks[task.id] ?? {};
              const select = h('select', { class: 'field', onchange: e => { setTaskField(draft, task.id, 'type', e.target.value || undefined); updateMeta(); changed(); } },
                typeOptions());
              select.value = entry.type && draft.taskTypes.some(t => t.id === entry.type) ? entry.type : '';
              return h('div', { class: 'row row-task' },
                h('span', { class: 'name' }, task.title),
                select,
                textInput(entry.motivation, 'Motivation (optional)', v => { setTaskField(draft, task.id, 'motivation', v); changed(); }, 'motivation'),
              );
            }),
          );
        }).filter(Boolean);
        return listEls.length ? h('section', { class: 'task-area' }, h('h3', {}, area.name), listEls) : null;
      }).filter(Boolean));
      if (!container.children.length) {
        container.append(h('p', { class: 'empty' }, groups.length ? 'Keine Aufgabe passt zur Suche.' : 'Noch keine Liste mit offenen Aufgaben ist einem Bereich zugeordnet.'));
      }
    }
    fill();

    return [
      hint('Alle offenen Aufgaben der zugeordneten Listen – auch die, die wegen der Höchstzahl gerade nicht im Diagramm stehen.'),
      h('input', { type: 'search', class: 'field search', placeholder: 'Aufgaben suchen …', value: taskFilter,
        oninput: e => { taskFilter = e.target.value; fill(); } }),
      container,
    ];
  }

  // ── Darstellung ────────────────────────────────────────────
  function displayTab() {
    return [
      hint('Das Theme gilt für alle Geräte, weil es in der Konfiguration gespeichert wird.'),
      h('div', { class: 'theme-choices' },
        themes.map(theme => h('label', { class: 'theme-choice' },
          h('input', { type: 'radio', name: 'theme', value: theme.id, checked: draft.theme === theme.id,
            onchange: () => { draft.theme = theme.id; changed(); } }),
          h('span', { class: 'swatches' }, theme.palette.slice(0, 5).map(c => h('span', { style: `background:${c}` }))),
          theme.name,
        )),
      ),
    ];
  }

  // ── Aufräumen ──────────────────────────────────────────────
  function cleanupTab() {
    const o = findOrphans(draft, data);
    const total = countOrphans(o);
    if (total === 0) return [hint('Keine verwaisten Einträge. Alles sauber.')];
    const item = (label, detail) => h('li', {}, label, detail ? h('span', { class: 'meta' }, ` ${detail}`) : null);
    return [
      hint('Diese Einträge in der Konfiguration gehören zu Listen oder Aufgaben, die es in To Do nicht mehr gibt oder die erledigt sind. Die App entfernt sie nie von selbst.'),
      h('ul', { class: 'orphans' },
        o.lists.length ? item(plural(o.lists.length, 'Liste', 'Listen'), '(gelöscht)') : null,
        o.tasks.length ? item(plural(o.tasks.length, 'Aufgabe', 'Aufgaben'), '(erledigt oder gelöscht)') : null,
        o.listAreaRefs.length ? item(plural(o.listAreaRefs.length, 'Liste verweist', 'Listen verweisen'), 'auf einen gelöschten Bereich') : null,
        o.taskTypeRefs.length ? item(plural(o.taskTypeRefs.length, 'Aufgabe verweist', 'Aufgaben verweisen'), 'auf einen gelöschten Typ') : null,
      ),
      h('button', { type: 'button', class: 'btn', onclick: () => { removeOrphans(draft, data); changed(true); } },
        `${plural(total, 'Eintrag', 'Einträge')} entfernen`),
    ];
  }

  const TAB_CONTENT = { areas: areasTab, lists: listsTab, types: typesTab, tasks: tasksTab, display: displayTab, cleanup: cleanupTab };

  function render() {
    root.replaceChildren(
      h('div', { class: 'settings' },
        toolbar(),
        tabs(),
        h('div', { class: `settings-body tab-${tab}` }, TAB_CONTENT[tab]()),
      ),
    );
    updateToolbar();
  }

  async function save() {
    if (!isDirty() || saving) return;
    saving = true;
    updateToolbar();
    try {
      const saved = await onSave(structuredClone(draft), base);
      base = structuredClone(saved);
      draft = structuredClone(saved);
      render();
    } catch {
      // Fehlermeldung zeigt onSave; der Entwurf bleibt erhalten
    } finally {
      saving = false;
      updateToolbar();
    }
  }

  function close() {
    if (isDirty() && !confirm('Es gibt ungespeicherte Änderungen. Verwerfen?')) return;
    onClose();
  }

  return {
    open({ data: d, config, tab: startTab }) {
      data = d;
      base = structuredClone(config);
      draft = structuredClone(config);
      if (startTab) tab = startTab;
      render();
    },
    get dirty() {
      return draft !== null && isDirty();
    },
  };
}

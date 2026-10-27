// ═══════════════════════════════════════════════════════════════
//  APP  –  verbindet Auth, Source, Config-Store, Model, Render und Themes
// ═══════════════════════════════════════════════════════════════

import { APP_CONFIG } from './app-config.js';
import { createAuth } from './auth/msal.js';
import { createGraphClient } from './graph/client.js';
import { createSampleSource, SAMPLE_CONFIG } from './source/sample.js';
import { createTodoSource } from './source/todo.js';
import { createMemoryConfigStore } from './configStore/memory.js';
import { createTodoTaskConfigStore } from './configStore/todoTask.js';
import { ConfigError } from './configStore/codec.js';
import { buildView, buildAreaTree, buildTypeTree, CONFIG_TASK_TITLE } from './model/model.js';
import { renderSunburst, renderLegend } from './render/sunburst.js';
import { createSettingsView, stableStringify } from './settings/settingsView.js';
import { THEMES, getTheme, applyTheme } from '../themes/index.js';

const MODE_LABELS = {
  area: 'Bereich · Aktivität · Aufgabe',
  type: 'Aufgabentyp · Aufgabe',
};
const NEW_LIST_NAME = 'Sunburst';

const state = {
  mode: 'area',
  expanded: new Set(),
  data: null,
  config: null,
  configStore: null,
  settings: null,
};

const $ = id => document.getElementById(id);

function showScreen(name) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== `screen-${name}`;
  $('view-controls').hidden = name !== 'chart';
}

function showToast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.hidden = true; }, 8000);
}

function currentTheme() {
  return getTheme(state.config?.theme);
}

// ── Diagramm ─────────────────────────────────────────────────
function render() {
  const theme = currentTheme();
  const view = buildView(state.data, state.config, { expanded: state.expanded });
  const tree = state.mode === 'area' ? buildAreaTree(view, state.config) : buildTypeTree(view, state.config);

  renderSunburst($('sunburst'), tree, {
    mode: state.mode,
    theme,
    tooltipEl: $('tooltip'),
    onToggleList: listId => {
      if (state.expanded.has(listId)) state.expanded.delete(listId);
      else state.expanded.add(listId);
      render();
    },
  });
  renderLegend($('legend'), tree, theme);
  $('chart-empty').hidden = tree.children.length > 0;
  $('legend-title').textContent = state.mode === 'area' ? 'Bereiche' : 'Aufgabentypen';
  $('mode-label').textContent = MODE_LABELS[state.mode];
  renderUnassignedHint(view.unassignedLists);
}

function renderUnassignedHint(lists) {
  const el = $('unassigned-hint');
  el.hidden = lists.length === 0;
  if (el.hidden) return;
  const title = document.createElement('strong');
  title.textContent = lists.length === 1 ? '1 Liste ohne Bereich' : `${lists.length} Listen ohne Bereich`;
  const ul = document.createElement('ul');
  for (const list of lists) {
    const li = document.createElement('li');
    li.textContent = list.name;
    ul.appendChild(li);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.textContent = 'Listen zuordnen';
  button.onclick = () => openSettings('lists');
  el.replaceChildren(title, ul, button);
}

function setupControls() {
  for (const btn of $('mode-switcher').querySelectorAll('button')) {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      for (const b of $('mode-switcher').querySelectorAll('button')) b.classList.toggle('active', b === btn);
      render();
    });
  }

  $('settings-btn').addEventListener('click', () => openSettings());
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-open-settings]');
    if (!link) return;
    e.preventDefault();
    openSettings(link.dataset.openSettings);
  });

  state.settings = createSettingsView($('screen-settings'), {
    themes: THEMES,
    onSave: saveConfig,
    onClose: () => {
      showScreen('chart');
      render();
    },
  });
  window.addEventListener('beforeunload', e => {
    if (state.settings.dirty && !$('screen-settings').hidden) e.preventDefault();
  });
}

// ── Einstellungen ────────────────────────────────────────────
function openSettings(tab) {
  state.settings.open({ data: state.data, config: state.config, tab });
  showScreen('settings');
  window.scrollTo(0, 0);
}

// Schreibt den Entwurf nur, wenn die gespeicherte Konfiguration seit dem
// Öffnen der Einstellungen unverändert ist (z.B. nicht in einem anderen Tab geändert).
async function saveConfig(draft, base) {
  try {
    state.config = await state.configStore.update(current => {
      if (stableStringify(current) !== stableStringify(base)) {
        throw new Error('Die Konfiguration wurde inzwischen an anderer Stelle geändert. ' +
          'Lade die Seite neu und mache die Änderungen nochmals.');
      }
      return draft;
    });
  } catch (err) {
    console.error(err);
    showToast(`Speichern fehlgeschlagen: ${err.message}`);
    throw err;
  }
  applyTheme(currentTheme());
  showToast('Gespeichert.');
  return state.config;
}

function showChart(sourceInfo) {
  $('source-info').textContent = sourceInfo;
  applyTheme(currentTheme());
  setupControls();
  showScreen('chart');
  render();
}

// ── Einrichtung des Konfigurations-Tasks ─────────────────────
function radioOption(name, value, label, checked) {
  const wrap = document.createElement('label');
  wrap.className = 'setup-option';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.checked = checked;
  wrap.append(input, document.createTextNode(label));
  return wrap;
}

function waitForChoice({ title, text, button, options }) {
  $('setup-title').textContent = title;
  $('setup-text').textContent = text;
  $('setup-ok').textContent = button;
  $('setup-options').replaceChildren(...options.map((o, i) => radioOption('setup', o.value, o.label, i === 0)));
  showScreen('setup');
  return new Promise(resolve => {
    $('setup-ok').onclick = () => {
      const chosen = $('setup-options').querySelector('input:checked');
      $('setup-ok').onclick = null;
      resolve(chosen.value);
    };
  });
}

async function createConfigTask(store, data) {
  const choice = await waitForChoice({
    title: 'Konfiguration einrichten',
    text: `In deinem To Do gibt es noch keinen Task „${CONFIG_TASK_TITLE}“. ` +
      'Darin speichert die App Bereiche, Typen und Motivationen. Der Task wird als erledigt markiert ' +
      'und stört deshalb nicht. In welcher Liste soll er liegen?',
    button: 'Konfiguration anlegen',
    options: [
      { value: '', label: `Neue Liste „${NEW_LIST_NAME}“ anlegen` },
      ...data.lists.map(l => ({ value: l.id, label: l.name })),
    ],
  });

  showScreen('loading');
  $('loading-text').textContent = 'Lege die Konfiguration an …';
  let listId = choice;
  if (!listId) {
    const list = await store.createList(NEW_LIST_NAME);
    data.lists.push(list);
    listId = list.id;
  }
  const config = await store.create(listId);
  data.tasks.push({
    id: '_config', listId, title: CONFIG_TASK_TITLE,
    completed: true, important: false, due: null, categories: [],
  });
  return config;
}

async function chooseConfigTask(candidates) {
  const value = await waitForChoice({
    title: 'Mehrere Konfigurationen gefunden',
    text: `Es gibt ${candidates.length} Tasks „${CONFIG_TASK_TITLE}“. Welcher soll verwendet werden? ` +
      'Die anderen werden nicht verändert; lösche sie am besten in To Do, damit diese Frage nicht wieder kommt.',
    button: 'Diese verwenden',
    options: candidates.map((c, i) => ({ value: String(i), label: `In Liste „${c.listName}“` })),
  });
  return candidates[Number(value)];
}

// ── Start ────────────────────────────────────────────────────
async function startSample() {
  state.data = await createSampleSource().load();
  state.configStore = createMemoryConfigStore(SAMPLE_CONFIG);
  state.config = await state.configStore.load();

  $('source-badge').textContent = 'Beispieldaten';
  $('source-badge').hidden = false;
  showChart('Frei erfundene Beispieldaten, keine Anmeldung. Änderungen gehen beim Neuladen verloren.');
}

async function startTodo() {
  const auth = await createAuth(APP_CONFIG);
  if (!auth.account) {
    $('login-btn').onclick = () => auth.login();
    showScreen('welcome');
    return;
  }

  $('account-name').textContent = auth.account.name || auth.account.username;
  $('logout-btn').onclick = () => auth.logout();
  $('account').hidden = false;
  showScreen('loading');

  const graph = createGraphClient(() => auth.getToken());
  const store = createTodoTaskConfigStore(graph);
  state.configStore = store;
  state.data = await createTodoSource(graph).load();

  const candidates = store.findCandidates(state.data);
  if (candidates.length === 0) {
    state.config = await createConfigTask(store, state.data);
  } else {
    store.use(candidates.length === 1 ? candidates[0] : await chooseConfigTask(candidates));
    $('loading-text').textContent = 'Lese die Konfiguration …';
    showScreen('loading');
    state.config = await store.load();
  }

  const configList = state.data.lists.find(l => l.id === store.listId);
  showChart(`Live aus Microsoft To Do. ${state.data.lists.length} Listen, ` +
    `${state.data.tasks.filter(t => !t.completed).length} offene Aufgaben. ` +
    `Konfiguration in Liste „${configList?.name ?? '?'}“.`);
}

async function start() {
  applyTheme(currentTheme());
  try {
    const sampleMode = !APP_CONFIG.clientId || new URLSearchParams(location.search).has('beispiel');
    await (sampleMode ? startSample() : startTodo());
  } catch (err) {
    console.error(err);
    $('error-text').textContent = err instanceof ConfigError
      ? `Die Konfiguration im Task „${CONFIG_TASK_TITLE}“ ist ungültig. ${err.message} Die Notiz wurde nicht verändert.`
      : err.message;
    showScreen('error');
  }
}

start();

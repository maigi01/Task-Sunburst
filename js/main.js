// ═══════════════════════════════════════════════════════════════
//  APP  –  verbindet Source, Config-Store, Model, Render und Themes
// ═══════════════════════════════════════════════════════════════

import { APP_CONFIG } from './app-config.js';
import { createSampleSource, SAMPLE_CONFIG } from './source/sample.js';
import { createMemoryConfigStore } from './configStore/memory.js';
import { buildView, buildAreaTree, buildTypeTree } from './model/model.js';
import { renderSunburst, renderLegend } from './render/sunburst.js';
import { THEMES, getTheme, applyTheme } from '../themes/index.js';

const MODE_LABELS = {
  area: 'Bereich · Aktivität · Aufgabe',
  type: 'Aufgabentyp · Aufgabe',
};

const state = {
  mode: 'area',
  expanded: new Set(),
  data: null,
  config: null,
};

const $ = id => document.getElementById(id);

// Solange die Anmeldung fehlt, gibt es nur Beispieldaten.
function createBackend() {
  if (!APP_CONFIG.clientId || new URLSearchParams(location.search).has('beispiel')) {
    return { source: createSampleSource(), configStore: createMemoryConfigStore(SAMPLE_CONFIG) };
  }
  throw new Error('Die Anmeldung bei Microsoft To Do ist noch nicht umgesetzt.');
}

function currentTheme() {
  return getTheme(state.config?.theme);
}

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
  el.replaceChildren(title, ul);
}

function setupControls(configStore) {
  for (const btn of $('mode-switcher').querySelectorAll('button')) {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      for (const b of $('mode-switcher').querySelectorAll('button')) b.classList.toggle('active', b === btn);
      render();
    });
  }

  const select = $('theme-select');
  select.replaceChildren(...THEMES.map(t => new Option(t.name, t.id)));
  select.value = currentTheme().id;
  select.addEventListener('change', async () => {
    state.config = { ...state.config, theme: select.value };
    applyTheme(currentTheme());
    render();
    await configStore.save(state.config);
  });
}

function showError(message) {
  const el = $('error');
  el.textContent = message;
  el.hidden = false;
}

async function start() {
  try {
    const { source, configStore } = createBackend();
    [state.data, state.config] = await Promise.all([source.load(), configStore.load()]);

    if (source.kind === 'sample') {
      $('source-badge').textContent = 'Beispieldaten';
      $('source-badge').hidden = false;
      $('source-info').textContent =
        'Frei erfundene Beispieldaten, keine Anmeldung. Änderungen gehen beim Neuladen verloren.';
    }

    applyTheme(currentTheme());
    setupControls(configStore);
    render();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

start();

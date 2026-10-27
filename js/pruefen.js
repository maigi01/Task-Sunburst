// ═══════════════════════════════════════════════════════════════
//  API-PRÜFUNG  –  klärt die Punkte aus „Noch zu prüfen“ (CLAUDE.md)
//
//  Arbeitet ausschliesslich in zwei eigenen Testlisten.
// ═══════════════════════════════════════════════════════════════

import { APP_CONFIG } from './app-config.js';
import { createAuth } from './auth/msal.js';
import { createGraphClient } from './graph/client.js';
import { DEFAULT_CONFIG, encodeConfigNote, decodeConfigNote, validateConfig } from './configStore/codec.js';
import { stableStringify } from './settings/settingsView.js';
import { applyTheme, getTheme } from '../themes/index.js';

const LIST_A = 'Sunburst-Prüfung A';
const LIST_B = 'Sunburst-Prüfung B';
const SIZE_TASK = 'Prüfung: Notizgrösse';
const MOVE_TASK = 'Prüfung: Verschieben';
const EDIT_TASK = 'Prüfung: Notiz bearbeiten';
const SIZES = [1000, 5000, 10000, 20000, 50000, 100000, 200000];
const STORAGE_PREFIX = 'sunburst-pruefung-';

const $ = id => document.getElementById(id);
const enc = encodeURIComponent;
let graph = null;

// ── Protokoll ────────────────────────────────────────────────
function log(line) {
  $('log').textContent += `${line}\n`;
  $('log').scrollTop = $('log').scrollHeight;
}

const remember = (key, value) => {
  try { localStorage.setItem(STORAGE_PREFIX + key, value); } catch { /* nur Komfort */ }
};
const recall = key => {
  try { return localStorage.getItem(STORAGE_PREFIX + key); } catch { return null; }
};

// ── Testlisten und -Tasks ────────────────────────────────────
async function findList(name) {
  return (await graph.getAll('/me/todo/lists')).find(l => l.displayName === name) ?? null;
}

async function ensureList(name) {
  return (await findList(name)) ?? graph.post('/me/todo/lists', { displayName: name });
}

async function findTask(listId, title) {
  return (await graph.getAll(`/me/todo/lists/${enc(listId)}/tasks?$top=100`)).find(t => t.title === title) ?? null;
}

async function ensureTask(listId, title, body) {
  const existing = await findTask(listId, title);
  if (existing) {
    if (body) await graph.patch(`/me/todo/lists/${enc(listId)}/tasks/${enc(existing.id)}`, { body });
    return existing;
  }
  return graph.post(`/me/todo/lists/${enc(listId)}/tasks`, { title, ...(body ? { body } : {}) });
}

// Konfiguration, deren Notiz mindestens `target` Zeichen lang ist.
// Enthält Umlaute, typografische Anführungszeichen, & und <>, wie echte Motivationen.
function configOfSize(target) {
  const config = validateConfig(structuredClone(DEFAULT_CONFIG));
  let i = 0;
  while (encodeConfigNote(config).length < target) {
    for (let k = 0; k < 25; k++, i++) {
      config.tasks[`pruefung-${i}`] = { type: 'lernen', motivation: `Motivation ${i}: Grösse prüfen – „äöü“ & <ok>` };
    }
  }
  return config;
}

function compareNote(body, expected) {
  try {
    const decoded = decodeConfigNote(body);
    return stableStringify(decoded) === stableStringify(expected) ? 'JSON unverändert' : 'JSON lesbar, aber VERÄNDERT';
  } catch (err) {
    return `FEHLER beim Lesen: ${err.message}`;
  }
}

// ── 1 · Notizgrösse ──────────────────────────────────────────
async function testSize() {
  log('── Test 1: Notizgrösse ──');
  const list = await ensureList(LIST_A);
  const task = await ensureTask(list.id, SIZE_TASK);
  const path = `/me/todo/lists/${enc(list.id)}/tasks/${enc(task.id)}`;

  for (const size of SIZES) {
    const config = configOfSize(size);
    const text = encodeConfigNote(config);
    try {
      await graph.patch(path, { body: { contentType: 'text', content: text } });
    } catch (err) {
      log(`${text.length} Zeichen: Schreiben FEHLGESCHLAGEN – ${err.message}`);
      break;
    }
    const read = await graph.get(path);
    const content = read.body?.content ?? '';
    log(`${text.length} Zeichen geschrieben → ${content.length} gelesen (${read.body?.contentType}), ${compareNote(read.body, config)}`);
    if (size === SIZES[0]) log(`   Anfang der gelesenen Notiz: ${JSON.stringify(content.slice(0, 160))}`);
  }
  log('Test 1 fertig.');
}

// ── 2 · Verschieben ──────────────────────────────────────────
async function prepareMove() {
  log('── Test 2: Verschieben vorbereiten ──');
  const [a, b] = [await ensureList(LIST_A), await ensureList(LIST_B)];
  const inB = await findTask(b.id, MOVE_TASK);
  if (inB) {
    await graph.delete(`/me/todo/lists/${enc(b.id)}/tasks/${enc(inB.id)}`);
    log('Alten Test-Task in Liste B entfernt.');
  }
  const task = await ensureTask(a.id, MOVE_TASK);
  remember('move-id', task.id);
  log(`Task „${MOVE_TASK}“ liegt in „${LIST_A}“, ID …${task.id.slice(-12)}`);
  log('Jetzt in der To-Do-App nach „Sunburst-Prüfung B“ verschieben, dann „Prüfen“.');
}

async function checkMove() {
  log('── Test 2: Verschieben prüfen ──');
  const before = recall('move-id');
  if (!before) return log('Bitte zuerst „Test-Task anlegen“ ausführen.');
  const [a, b] = [await findList(LIST_A), await findList(LIST_B)];
  const inB = b && await findTask(b.id, MOVE_TASK);
  const inA = a && await findTask(a.id, MOVE_TASK);
  if (!inB) {
    return log(inA ? 'Der Task liegt noch in Liste A – bitte in der To-Do-App verschieben.' : 'Task in keiner Testliste gefunden.');
  }
  log(`Vorher: …${before.slice(-12)}  Nachher: …${inB.id.slice(-12)}`);
  log(inB.id === before ? 'ERGEBNIS: Die ID bleibt beim Verschieben GLEICH.' : 'ERGEBNIS: Die ID ÄNDERT sich beim Verschieben.');
}

// ── 3 · Notiz in der To-Do-App bearbeiten ────────────────────
function editConfig() {
  const config = validateConfig(structuredClone(DEFAULT_CONFIG));
  config.areas.push({ id: 'pruefung', name: 'Prüfung „äöü“ & <Test>', motivation: 'Zeile mit\tTab und  zwei Leerzeichen' });
  config.tasks['beispiel'] = { type: 'lernen', motivation: "Sag's mit 'Apostroph' und \"Zitat\"" };
  return config;
}

async function prepareEdit() {
  log('── Test 3: Notiz bearbeiten vorbereiten ──');
  const list = await ensureList(LIST_A);
  await ensureTask(list.id, EDIT_TASK, { contentType: 'text', content: encodeConfigNote(editConfig()) });
  log(`Task „${EDIT_TASK}“ mit Konfiguration in „${LIST_A}“ angelegt.`);
  log('Jetzt in der To-Do-App am Ende der Notiz eine Zeile „Hallo“ anfügen, dann „Prüfen“.');
}

async function checkEdit() {
  log('── Test 3: Notiz bearbeiten prüfen ──');
  const list = await findList(LIST_A);
  const task = list && await findTask(list.id, EDIT_TASK);
  if (!task) return log('Bitte zuerst „Test-Task mit Konfiguration anlegen“ ausführen.');
  const body = task.body ?? {};
  const content = body.content ?? '';
  log(`contentType: ${body.contentType}, Länge: ${content.length}, „Hallo“ gefunden: ${content.includes('Hallo') ? 'ja' : 'NEIN'}`);
  log(`Ergebnis: ${compareNote(body, editConfig())}`);
  log(`Anfang: ${JSON.stringify(content.slice(0, 300))}`);
  log(`Ende:   ${JSON.stringify(content.slice(-300))}`);
}

// ── Aufräumen ────────────────────────────────────────────────
async function cleanup() {
  if (!confirm(`Die Listen „${LIST_A}“ und „${LIST_B}“ mit allen Test-Tasks löschen?`)) return;
  for (const name of [LIST_A, LIST_B]) {
    const list = await findList(name);
    if (list) {
      await graph.delete(`/me/todo/lists/${enc(list.id)}`);
      log(`„${name}“ gelöscht.`);
    }
  }
  remember('move-id', '');
}

const ACTIONS = {
  size: testSize,
  'move-prepare': prepareMove,
  'move-check': checkMove,
  'edit-prepare': prepareEdit,
  'edit-check': checkEdit,
  cleanup,
  copy: async () => {
    await navigator.clipboard.writeText($('log').textContent);
    log('(Protokoll in die Zwischenablage kopiert)');
  },
};

async function start() {
  applyTheme(getTheme('hell'));
  const auth = await createAuth(APP_CONFIG);
  if (!auth.account) {
    $('login-needed').hidden = false;
    return;
  }
  graph = createGraphClient(() => auth.getToken());
  $('checks').hidden = false;
  log(`Prüfung gestartet ${new Date().toLocaleString('de-CH')}`);

  document.addEventListener('click', async e => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const buttons = document.querySelectorAll('[data-action]');
    buttons.forEach(b => { b.disabled = true; });
    try {
      await ACTIONS[button.dataset.action]();
    } catch (err) {
      console.error(err);
      log(`FEHLER: ${err.message}`);
    } finally {
      buttons.forEach(b => { b.disabled = false; });
    }
  });
}

start().catch(err => {
  console.error(err);
  document.body.append(Object.assign(document.createElement('p'), { textContent: `Fehler: ${err.message}` }));
});

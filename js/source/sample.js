// ═══════════════════════════════════════════════════════════════
//  SOURCE: Beispieldaten  –  frei erfunden, ohne Anmeldung nutzbar
//
//  Liefert dasselbe neutrale Datenmodell wie später der To-Do-Adapter.
//  Fälligkeiten sind relativ zu heute, damit die Sortierung sichtbar bleibt.
// ═══════════════════════════════════════════════════════════════

import { CONFIG_TASK_TITLE, CATEGORY_HIDDEN, CATEGORY_DELEGATED } from '../model/model.js';

const LISTS = [
  { id: 'list-weiterbildung', name: 'Weiterbildung' },
  { id: 'list-kundenprojekt', name: 'Kundenprojekt Alpha' },
  { id: 'list-wohnung',       name: 'Wohnung' },
  { id: 'list-vorraete',      name: 'Einkauf & Vorräte' },
  { id: 'list-garten',        name: 'Garten' },
  { id: 'list-fotografie',    name: 'Fotografie' },
  { id: 'list-laufen',        name: 'Laufen' },
  { id: 'list-kochen',        name: 'Kochen' },
  { id: 'list-ideen',         name: 'Ideen-Inbox' },
  { id: 'list-reisen',        name: 'Reiseplanung' },
  { id: 'list-sunburst',      name: 'Sunburst' },
];

// [id, listId, title, { due: Tage ab heute, important, completed, categories }]
const TASKS = [
  ['t01', 'list-weiterbildung', 'Online-Kurs Statistik, Modul 3', { due: 2 }],
  ['t02', 'list-weiterbildung', 'Fachartikel zusammenfassen',     { important: true }],
  ['t03', 'list-weiterbildung', 'Konferenz-Talks nachschauen',    {}],
  ['t04', 'list-weiterbildung', 'Lernkarten wiederholen',         {}],
  ['t05', 'list-weiterbildung', 'Buch „Gute Gewohnheiten“',       {}],
  ['t06', 'list-weiterbildung', 'Zertifikat anmelden',            { due: 6 }],
  ['t07', 'list-weiterbildung', 'Notizen digitalisieren',         {}],
  ['t08', 'list-weiterbildung', 'Podcast-Liste aufräumen',        {}],
  ['t09', 'list-weiterbildung', 'Alten Kurs abschliessen',        { completed: true }],

  ['t10', 'list-kundenprojekt', 'Angebot überarbeiten',           { due: -1, important: true }],
  ['t11', 'list-kundenprojekt', 'Workshop vorbereiten',           { due: 4 }],
  ['t12', 'list-kundenprojekt', 'Protokoll verschicken',          { categories: [CATEGORY_DELEGATED] }],
  ['t13', 'list-kundenprojekt', 'Prototyp testen',                {}],

  ['t14', 'list-wohnung',       'Keller entrümpeln',              {}],
  ['t15', 'list-wohnung',       'Lampe im Flur ersetzen',         { important: true }],
  ['t16', 'list-wohnung',       'Fenster putzen',                 {}],
  ['t17', 'list-wohnung',       'Regal aufbauen',                 { categories: [CATEGORY_HIDDEN] }],
  ['t18', 'list-wohnung',       'Unterlagen ablegen',             {}],

  ['t19', 'list-vorraete',      'Wocheneinkauf planen',           { due: 1 }],
  ['t20', 'list-vorraete',      'Vorratsschrank prüfen',          {}],

  ['t21', 'list-garten',        'Tomaten pikieren',               { due: 3 }],
  ['t22', 'list-garten',        'Kompost umsetzen',               {}],
  ['t23', 'list-garten',        'Hochbeet planen',                {}],

  ['t24', 'list-fotografie',    'Bilder vom Ausflug sortieren',   {}],
  ['t25', 'list-fotografie',    'Fotobuch gestalten',             { important: true }],
  ['t26', 'list-fotografie',    'Objektiv reinigen',              {}],

  ['t27', 'list-laufen',        'Intervalltraining',              {}],
  ['t28', 'list-laufen',        'Laufschuhe kaufen',              { due: 5 }],
  ['t29', 'list-laufen',        'Anmeldung Stadtlauf',            { important: true }],

  ['t30', 'list-ideen',         'Idee: Werkzeugbibliothek',       {}],
  ['t31', 'list-reisen',        'Zugverbindungen vergleichen',    {}],

  ['t99', 'list-sunburst',      CONFIG_TASK_TITLE,                { completed: true }],
];

export const SAMPLE_CONFIG = {
  version: 1,
  theme: 'hell',
  defaultMaxTasks: 5,
  areas: [
    { id: 'beruf',      name: 'Beruf',      motivation: 'Gute Arbeit machen und dabei dazulernen.' },
    { id: 'haushalt',   name: 'Haushalt',   motivation: 'Ein Zuhause, in dem man gerne ist.' },
    { id: 'freizeit',   name: 'Freizeit',   motivation: 'Zeit für das, was Freude macht.' },
    { id: 'gesundheit', name: 'Gesundheit', motivation: 'Fit bleiben, ohne Stress.' },
  ],
  taskTypes: [
    { id: 'projekt',     name: 'Projekt' },
    { id: 'routine',     name: 'Routine' },
    { id: 'lernen',      name: 'Lernen' },
    { id: 'lesen',       name: 'Lesen' },
    { id: 'sammeln',     name: 'Sammeln & Sortieren' },
    { id: 'ordnung',     name: 'Ordnung schaffen' },
    { id: 'experiment',  name: 'Experimentieren' },
    { id: 'zeit-fuer-mich', name: 'Zeit für mich' },
  ],
  lists: {
    'list-weiterbildung': { area: 'beruf', motivation: 'Jede Woche ein Stück weiter.' },
    'list-kundenprojekt': { area: 'beruf', maxTasks: 3 },
    'list-wohnung':       { area: 'haushalt', motivation: 'Weniger Kram, mehr Platz.' },
    'list-vorraete':      { area: 'haushalt' },
    'list-garten':        { area: 'freizeit', motivation: 'Draussen sein und etwas wachsen sehen.' },
    'list-fotografie':    { area: 'freizeit' },
    'list-laufen':        { area: 'gesundheit' },
    'list-kochen':        { area: 'gesundheit', motivation: 'Öfter frisch kochen.' },
  },
  tasks: {
    t01: { type: 'lernen',  motivation: 'Damit die Auswertungen im Job leichter fallen.' },
    t02: { type: 'lesen' },
    t03: { type: 'lernen' },
    t04: { type: 'routine' },
    t05: { type: 'lesen',   motivation: 'Kleine Schritte, grosse Wirkung.' },
    t07: { type: 'ordnung' },
    t08: { type: 'sammeln' },
    t10: { type: 'projekt', motivation: 'Ein klares Angebot spart später Diskussionen.' },
    t11: { type: 'projekt' },
    t13: { type: 'experiment' },
    t14: { type: 'ordnung', motivation: 'Platz schaffen für Neues.' },
    t16: { type: 'routine' },
    t18: { type: 'ordnung' },
    t19: { type: 'routine' },
    t21: { type: 'experiment' },
    t22: { type: 'routine' },
    t23: { type: 'projekt' },
    t24: { type: 'sammeln' },
    t25: { type: 'projekt', motivation: 'Erinnerungen zum Anfassen.' },
    t27: { type: 'routine', motivation: 'Dranbleiben zählt mehr als Tempo.' },
    t29: { type: 'zeit-fuer-mich' },
  },
};

function daysFromToday(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export function createSampleSource() {
  return {
    kind: 'sample',
    async load() {
      return {
        lists: LISTS.map(l => ({ ...l })),
        tasks: TASKS.map(([id, listId, title, o]) => ({
          id,
          listId,
          title,
          completed: Boolean(o.completed),
          important: Boolean(o.important),
          due: o.due === undefined ? null : daysFromToday(o.due),
          categories: o.categories ?? [],
        })),
      };
    },
  };
}

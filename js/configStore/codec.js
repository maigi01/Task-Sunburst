// ═══════════════════════════════════════════════════════════════
//  KONFIGURATION  –  Standardwerte, Validierung, Ein-/Auspacken
//
//  Unabhängig vom Speicherort; reine Funktionen, ohne DOM testbar.
// ═══════════════════════════════════════════════════════════════

export const CONFIG_VERSION = 1;

export const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  theme: 'hell',
  defaultMaxTasks: 5,
  areas: [],
  taskTypes: [
    { id: 'projekt',        name: 'Projekt' },
    { id: 'routine',        name: 'Routine' },
    { id: 'lernen',         name: 'Lernen' },
    { id: 'lesen',          name: 'Lesen' },
    { id: 'sammeln',        name: 'Sammeln & Sortieren' },
    { id: 'ordnung',        name: 'Ordnung schaffen' },
    { id: 'experiment',     name: 'Experimentieren' },
    { id: 'zeit-fuer-mich', name: 'Zeit für mich' },
  ],
  lists: {},
  tasks: {},
};

export class ConfigError extends Error {}

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Prüft die Struktur und ergänzt fehlende optionale Felder.
// Wirft ConfigError mit allen gefundenen Problemen.
export function validateConfig(raw) {
  const errors = [];
  if (!isObject(raw)) throw new ConfigError('Die Konfiguration ist kein JSON-Objekt.');
  if (raw.version !== undefined && raw.version > CONFIG_VERSION) {
    errors.push(`Version ${raw.version} ist neuer als diese App (${CONFIG_VERSION}).`);
  }
  if (raw.defaultMaxTasks !== undefined && !(Number.isInteger(raw.defaultMaxTasks) && raw.defaultMaxTasks > 0)) {
    errors.push('„defaultMaxTasks“ muss eine ganze Zahl grösser 0 sein.');
  }
  for (const key of ['areas', 'taskTypes']) {
    if (raw[key] === undefined) continue;
    if (!Array.isArray(raw[key])) {
      errors.push(`„${key}“ muss eine Liste sein.`);
      continue;
    }
    raw[key].forEach((item, i) => {
      if (!isObject(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
        errors.push(`„${key}“ Eintrag ${i + 1} braucht „id“ und „name“.`);
      }
    });
  }
  for (const key of ['lists', 'tasks']) {
    if (raw[key] !== undefined && !isObject(raw[key])) errors.push(`„${key}“ muss ein Objekt sein.`);
  }
  if (errors.length) throw new ConfigError(errors.join(' '));

  return {
    ...raw,
    version: CONFIG_VERSION,
    theme: typeof raw.theme === 'string' ? raw.theme : DEFAULT_CONFIG.theme,
    defaultMaxTasks: raw.defaultMaxTasks ?? DEFAULT_CONFIG.defaultMaxTasks,
    areas: raw.areas ?? [],
    taskTypes: raw.taskTypes ?? [],
    lists: raw.lists ?? {},
    tasks: raw.tasks ?? {},
  };
}

// ── Notiz eines To-Do-Tasks ──────────────────────────────────
//  Geschrieben wird reiner Text. Gelesen wird robust, weil To Do die
//  Notiz als HTML zurückgibt und beim Bearbeiten umformatieren kann.

const NOTE_HEADER = 'Diese Notiz wird von der Sunburst-App verwaltet. Bitte nicht von Hand ändern.\n\n';

export function encodeConfigNote(config) {
  return NOTE_HEADER + JSON.stringify(config, null, 2);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function htmlToText(html) {
  return html
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return String.fromCodePoint(code);
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

// Liefert das validierte Konfigurationsobjekt oder wirft ConfigError
export function decodeConfigNote(body) {
  const content = body?.content ?? '';
  const text = (body?.contentType === 'html' ? htmlToText(content) : content)
    .replace(/ /g, ' ');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new ConfigError('In der Notiz wurde kein JSON gefunden.');

  let raw;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    throw new ConfigError(`Das JSON in der Notiz ist ungültig: ${err.message}`);
  }
  return validateConfig(raw);
}

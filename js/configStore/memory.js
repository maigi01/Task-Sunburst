// ═══════════════════════════════════════════════════════════════
//  CONFIG STORE: im Speicher  –  für den Beispieldaten-Modus
//
//  Gleiche Schnittstelle wie der Store im To-Do-Konfigurations-Task:
//    load()          → Konfiguration
//    update(change)  → change(aktuelle Konfiguration) speichern, Ergebnis zurück
// ═══════════════════════════════════════════════════════════════

export function createMemoryConfigStore(initial) {
  let current = structuredClone(initial);
  return {
    kind: 'memory',
    async load() {
      return structuredClone(current);
    },
    async update(change) {
      current = structuredClone(change(structuredClone(current)));
      return structuredClone(current);
    },
  };
}

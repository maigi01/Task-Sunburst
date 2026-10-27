// ═══════════════════════════════════════════════════════════════
//  CONFIG STORE: im Speicher  –  für den Beispieldaten-Modus
//
//  Gleiche Schnittstelle wie später der Store im To-Do-Konfigurations-Task:
//    load()  → Konfiguration
//    save(config)
// ═══════════════════════════════════════════════════════════════

export function createMemoryConfigStore(initial) {
  let current = structuredClone(initial);
  return {
    kind: 'memory',
    async load() {
      return structuredClone(current);
    },
    async save(config) {
      current = structuredClone(config);
    },
  };
}

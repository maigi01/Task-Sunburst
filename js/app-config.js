// ═══════════════════════════════════════════════════════════════
//  APP-KONFIGURATION  –  nicht geheim, keine Secrets hier ablegen
//
//  clientId: Anwendungs-ID der Azure-App-Registrierung.
//            Leer → die App startet mit Beispieldaten.
//            Mit ?beispiel in der Adresse gibt es die Beispieldaten auch so.
// ═══════════════════════════════════════════════════════════════

export const APP_CONFIG = {
  clientId: '0bc8eade-d107-47f6-ad09-ea4fd077a39a',
  authority: 'https://login.microsoftonline.com/consumers',
  scopes: ['User.Read', 'Tasks.ReadWrite'],
};

// ═══════════════════════════════════════════════════════════════
//  APP-KONFIGURATION  –  nicht geheim, keine Secrets hier ablegen
//
//  clientId: Anwendungs-ID der Azure-App-Registrierung.
//            Leer → die App startet mit Beispieldaten.
// ═══════════════════════════════════════════════════════════════

export const APP_CONFIG = {
  clientId: '',
  authority: 'https://login.microsoftonline.com/consumers',
  scopes: ['User.Read', 'Tasks.ReadWrite'],
};

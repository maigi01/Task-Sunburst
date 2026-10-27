// ═══════════════════════════════════════════════════════════════
//  THEMES  –  Registrierung und Anwendung
//
//  Ein Theme besteht aus CSS-Variablen, einer Palette für Bereiche/Typen,
//  einer neutralen Farbe für „Sonstige“ und der Richtung, in der äussere
//  Ringe abgestuft werden.
//  Neues Theme: Datei in themes/ anlegen und hier eintragen.
// ═══════════════════════════════════════════════════════════════

import hell from './hell.js';
import dunkel from './dunkel.js';

export const THEMES = [hell, dunkel];
export const DEFAULT_THEME_ID = hell.id;

export function getTheme(id) {
  return THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME_ID);
}

export function applyTheme(theme, root = document.documentElement) {
  for (const [name, value] of Object.entries(theme.vars)) root.style.setProperty(name, value);
  root.dataset.theme = theme.id;

  let link = document.getElementById('theme-fonts');
  if (theme.fonts) {
    if (!link) {
      link = document.createElement('link');
      link.id = 'theme-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== theme.fonts) link.href = theme.fonts;
  } else if (link) {
    link.remove();
  }
}

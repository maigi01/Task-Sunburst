# Task-Sunburst
Organise Tasks from Microsoft ToDo in a nice Sunburst overview

## Starten

Statische Browser-App ohne Build-Schritt. Lokal einen Webserver im Projektordner starten:

```sh
python3 -m http.server 8000
```

Dann <http://localhost:8000/> öffnen und mit dem Microsoft-Konto anmelden.

- Der Port muss **8000** sein: Microsoft leitet nach der Anmeldung nur an Adressen zurück, die in der App-Registrierung eingetragen sind (`http://localhost:8000/`). Für eine andere Adresse (z.B. GitHub Pages) muss sie dort zusätzlich als SPA-Umleitungs-URI eingetragen werden.
- <http://localhost:8000/?beispiel> zeigt frei erfundene Beispieldaten ohne Anmeldung.
- Beim ersten Start legt die App den Task „⚙ Sunburst-Konfiguration“ an (in einer neuen Liste „Sunburst“ oder einer bestehenden).
- <http://localhost:8000/pruefen.html> ist eine Prüfseite für offene Fragen zur Graph-API (Grösse der Notiz, ID beim Verschieben, Bearbeiten der Notiz in To Do). Sie arbeitet nur in eigenen Testlisten.

## Tests

Model, Konfigurationsformat und To-Do-Adapter (gegen eine simulierte Graph-API) haben Unit-Tests für Node.js 18+:

```sh
npm test
```

## Aufbau

| Pfad | Schicht |
|---|---|
| `js/auth/` | Anmeldung mit MSAL.js |
| `js/graph/` | Schlanker Client für die Graph-API |
| `js/source/` | Datenabruf (`todo.js` = Microsoft To Do, `sample.js` = Beispieldaten) |
| `js/configStore/` | Konfiguration (`todoTask.js` = Notiz des Konfigurations-Tasks, `memory.js` = Beispieldaten, `codec.js` = Format und Validierung) |
| `js/model/` | Filtern, Sortieren, Aufbau der Hierarchie |
| `js/render/` | Sunburst-Zeichnung, Tooltip, Legende |
| `themes/` | Grafische Designs (hell, dunkel) |
| `js/main.js` | Verbindet die Schichten |

Details zu Zielen und Regeln stehen in [CLAUDE.md](CLAUDE.md).

# Task-Sunburst
Organise Tasks from Microsoft ToDo in a nice Sunburst overview

## Starten

Statische Browser-App ohne Build-Schritt. Lokal einen Webserver im Projektordner starten:

```sh
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen. Solange in `js/app-config.js` keine `clientId` eingetragen ist, startet die App mit frei erfundenen Beispieldaten.

## Tests

Die Logik im Model (Filter, Sortierung, Hierarchie) hat Unit-Tests für Node.js 18+:

```sh
npm test
```

## Aufbau

| Pfad | Schicht |
|---|---|
| `js/source/` | Datenabruf (`sample.js` = Beispieldaten, später To Do) |
| `js/configStore/` | Laden/Speichern der Konfiguration |
| `js/model/` | Filtern, Sortieren, Aufbau der Hierarchie |
| `js/render/` | Sunburst-Zeichnung, Tooltip, Legende |
| `themes/` | Grafische Designs (hell, dunkel) |
| `js/main.js` | Verbindet die Schichten |

Details zu Zielen und Regeln stehen in [CLAUDE.md](CLAUDE.md).

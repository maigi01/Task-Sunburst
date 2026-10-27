# Sunburst-Aufgabenübersicht

## Zweck

Eine Web-App, die Aufgaben aus **Microsoft To Do** als Sunburst-Diagramm darstellt. Sie dient der **Wochenplanung**: Ich sehe, welche Bereiche, Aktivitäten und Aufgaben gerade aktuell sind, und teile ihnen dann Zeitslots in meiner Agenda zu.

Grundsätze:
- **To Do ist die einzige Quelle für Aufgaben.** Erfassen und Abhaken passiert in der To-Do-App. Das Sunburst ist eine Ansicht darauf, kein zweites System.
- **Kein manueller Sync.** Alles wird beim Laden live über die Microsoft-Graph-API gelesen.
- **Wenig Pflegeaufwand.** Was das Sunburst zusätzlich braucht, steht in einer kleinen Konfiguration, die die App selbst verwaltet.

Benutzer: ein einzelner Nutzer mit **privatem Microsoft-Konto** (kein Geschäftskonto).

## Architektur

- Reine **Browser-App ohne Backend** (statische Dateien: HTML, JS, CSS).
- Vorschlag: Vanilla JavaScript mit ES-Modulen, **kein Build-Schritt**. Bibliotheken über CDN:
  - **D3.js** für das Sunburst
  - **MSAL.js (msal-browser)** für die Anmeldung
- **Hosting:** zuerst `http://localhost` (z.B. `python3 -m http.server`), später GitHub Pages oder ein Webserver im Homelab. Der Code darf keine Annahmen über den Hosting-Ort enthalten (relative Pfade, Redirect-URI aus `window.location` ableiten).
- **Schichten strikt trennen**, damit später Backend oder Konfigurationsspeicher ausgetauscht werden können (z.B. Vikunja statt To Do, OneDrive statt To-Do-Task):
  - `auth` – Anmeldung und Token
  - `source` – Datenabruf aus To Do (Adapter mit neutralem internen Datenmodell)
  - `configStore` – Laden/Speichern der Konfiguration
  - `model` – Filtern, Sortieren, Aufbau der Hierarchie
  - `render` – Sunburst-Zeichnung und Interaktion
  - `themes` – grafische Designs

## Anmeldung und API-Zugriff

- Azure-App-Registrierung (wird von mir manuell angelegt):
  - Kontotyp: persönliche Microsoft-Konten
  - Plattform: Single-Page-Application, Redirect-URIs für localhost und spätere Hosting-Adresse
- MSAL.js mit **Authorization Code Flow + PKCE** (kein Implicit Flow).
- Authority: `https://login.microsoftonline.com/consumers`
- Delegierte Berechtigungen: `User.Read`, `Tasks.ReadWrite`
- Die **Client-ID** steht in einer kleinen Konfigurationsdatei im Code (z.B. `app-config.js`); sie ist nicht geheim. Es gibt **keine** Secrets im Repository.
- Token werden von MSAL im Browser-Speicher gehalten. Bei abgelaufener Sitzung sauber neu anmelden (erst still versuchen, sonst Redirect).

## Datenmodell und Ringe

| Ring | Inhalt | Quelle |
|---|---|---|
| Innen | **Bereich** | in der Konfiguration definiert |
| Mitte | **Aktivität** = To-Do-Liste | To Do (`todoTaskList`) |
| Aussen | **Aufgabe** = To-Do-Task | To Do (`todoTask`) |

- Listen und Tasks werden über ihre Graph-`id` identifiziert.
- Jede Liste kann in der Konfiguration genau einem Bereich zugeordnet werden.
- Die Schritte (`checklistItems`) werden in v1 nicht dargestellt; ein optionaler vierter Ring ist eine spätere Erweiterung.

## Filterregeln

- **Listen ohne Bereichszuordnung** erscheinen nicht im Sunburst. Die App zeigt aber einen gut sichtbaren Hinweis an (z.B. „3 Listen ohne Bereich“), damit neue Listen nicht unbemerkt verschwinden.
- **Erledigte Tasks** werden nicht angezeigt.
- **Ausgeblendete Tasks:** Tasks mit der To-Do-Kategorie `Sunburst: aus` werden nicht angezeigt.
- **Delegierte Tasks:** Die Graph-API liefert keine Zuweisung an Personen. Ersatz: Tasks mit der Kategorie `delegiert` werden nicht angezeigt.
- Der **Konfigurations-Task** (siehe unten) wird nie angezeigt; seine Liste nur, wenn sie weitere Tasks enthält und einem Bereich zugeordnet ist.

## Aufgabentypen

Aufgabentypen und ihre Zuordnung zu Tasks stehen in der **Konfiguration**, nicht im Task selbst. Am Task in To Do wird dafür nichts gepflegt (keine Kategorien, keine Notiz).

- Die Liste der Typen steht in der Konfiguration (`taskTypes`), gepflegt in der Einstellungsansicht. Die Standardkonfiguration enthält als Ausgangsliste die bisher verwendeten Typen: Projekt, Routine, Lernen, Lesen, Sammeln & Sortieren, Ordnung schaffen, Experimentieren, Zeit für mich.
- Die Zuordnung Task → Typ steht unter `tasks`, über die Graph-`id` des Tasks. Jeder Task hat höchstens einen Typ.
- Task ohne Eintrag oder ohne Typ → Gruppe „Sonstige“.
- Die Typen werden im Tooltip angezeigt und sind die Grundlage der Typ-Ansicht (siehe „Ansichten“).
- Die Kategorien `delegiert` und `Sunburst: aus` (siehe „Filterregeln“) bleiben in To Do, weil sie direkt beim Erfassen gesetzt werden.

## Ansichten

Umschaltbar im Kopfbereich (wie in der früheren Offline-Version):

1. **Bereichs-Ansicht** (Standard): drei Ringe Bereich → Aktivität → Aufgabe.
2. **Typ-Ansicht**: zwei Ringe Aufgabentyp → Aufgabe. Es gelten dieselben Filter und dieselbe `maxTasks`-Auswahl wie in der Bereichs-Ansicht; die Typ-Ansicht gruppiert nur anders. Im Tooltip stehen zusätzlich Bereich und Aktivität.

## Motivation

Jede Ebene kann einen Motivationsspruch haben; er erscheint im **Tooltip** des Segments (abgesetzt, kursiv, mit 💡).

Alle Motivationen stehen in der **Konfiguration** (`motivation`) und werden in der Einstellungsansicht gepflegt:

- **Bereich:** unter `areas`
- **Aktivität (Liste):** unter `lists`
- **Aufgabe:** unter `tasks`, über die Graph-`id` des Tasks. Die Notiz des Tasks in To Do wird dafür nicht verwendet.

## Darstellung

Übernommen aus der früheren Offline-Version (eine einzelne HTML-Datei mit fest eingebetteten Daten):

- Jede Aufgabe hat das Gewicht 1. Eine Aktivität ohne sichtbare Aufgaben wird als eigenes Segment mit Gewicht 1 gezeichnet, damit sie nicht verschwindet.
- **Farben:** Jeder Bereich (bzw. Typ) bekommt eine Farbe aus der Palette des Themes. Die äusseren Ringe übernehmen sie und werden pro Ebene heller (`d3.color(...).brighter()`).
- **Beschriftung** radial (vom Zentrum nach aussen), auf der linken Seite gedreht, damit sie lesbar bleibt. Zu lange Namen werden mit „…“ gekürzt; zu schmale Segmente bleiben unbeschriftet.
- Schriftgrösse, Zeichenbreite und Mindest-Bogenlänge pro Ring sowie Diagrammgrösse, Zentrumsradius, Ringgrenzen und Abstand stehen als **zentrale Konstanten** im `render`-Modul (`LABEL_CONFIG`, `LAYOUT_CONFIG`), damit sie leicht anzupassen sind.
- **Zentrum:** Anzahl der angezeigten Aufgaben.
- **Seitenleiste:** Legende der Bereiche bzw. Typen.
- **Hover:** Tooltip mit Name, Ebene, Typ und Motivation; andere Segmente werden abgedunkelt.

## Sortierung und maximale Anzahl

Pro Liste werden höchstens `maxTasks` Tasks angezeigt (Wert pro Liste in der Konfiguration, sonst globaler Standardwert). Die Auswahl erfolgt als Kaskade:

1. Fällig innerhalb der nächsten **7 Tage** (`dueDateTime`), aufsteigend nach Datum
2. Als **wichtig** markiert (`importance = high`)
3. **Zufall** mit festem Startwert pro **Kalenderwoche** (ISO-Woche + Listen-ID als Seed), damit die Auswahl die ganze Woche stabil bleibt

Nicht verwendet:
- „Mein Tag“ – über die Graph-API für To Do nicht verfügbar.
- Von-bis-Zeiten aus der Outlook-Planung – vorerst weggelassen.

Sind mehr Tasks vorhanden als angezeigt, erscheint ein zusätzliches Segment **„+N weitere“**. Ein Klick darauf (oder auf das Listensegment) zeigt vorübergehend **alle** Tasks der Liste; ein weiterer Klick klappt wieder zu. Das ändert die Konfiguration nicht.

## Konfiguration

### Speicherort

Die Konfiguration liegt als **JSON in der Notiz eines speziellen To-Do-Tasks**:
- Titel: `⚙ Sunburst-Konfiguration`
- Der Task ist als **erledigt** markiert, damit er in der To-Do-App nicht stört.
- Die Notiz (`body`) ist über die API **HTML**. Das JSON muss beim Schreiben sauber eingebettet (escaped) und beim Lesen robust extrahiert werden, auch wenn To Do Formatierung oder Zeilenumbrüche verändert.
- Der Task-Titel ist auf ca. 255 Zeichen begrenzt; die Konfiguration gehört deshalb ausschliesslich in die Notiz.

### Ablauf beim Laden

1. Alle Listen und Tasks laden (inkl. erledigter, um den Konfigurations-Task zu finden).
2. Nach dem Konfigurations-Task suchen.
3. **Gefunden:** JSON lesen, validieren, Sunburst aufbauen. Bei ungültigem JSON eine klare Fehlermeldung anzeigen und nichts überschreiben.
4. **Nicht gefunden:** Dialog anzeigen – bestehende Liste wählen oder neue Liste „Sunburst“ anlegen. Dort den Task mit einer Standardkonfiguration erstellen.
5. **Mehrere gefunden:** Warnung anzeigen und den Nutzer wählen lassen; nie stillschweigend einen nehmen.

### Pflege

Die App hat eine **Einstellungsansicht**, in der ich:
- Bereiche anlege, umbenenne, sortiere und löschen kann
- jede Liste einem Bereich zuordne (oder keinem)
- `maxTasks` pro Liste und den globalen Standardwert setze
- Aufgabentypen anlege, umbenenne, sortiere und lösche
- jedem Task einen Typ und eine Motivation zuordne (Task-Auswahl gruppiert nach Bereich und Liste, inkl. der Tasks, die wegen `maxTasks` gerade nicht angezeigt werden)
- Motivationssprüche für Bereiche und Listen erfasse
- das Theme wähle

Änderungen werden in die Notiz des Konfigurations-Tasks zurückgeschrieben. Vor dem Schreiben die aktuelle Version neu laden, um Konflikte zu vermeiden.

### Schema (Vorschlag)

```json
{
  "version": 1,
  "theme": "hell",
  "defaultMaxTasks": 5,
  "areas": [
    { "id": "beruf", "name": "Beruf", "motivation": "…" },
    { "id": "homelab", "name": "Homelab", "motivation": "…" }
  ],
  "taskTypes": [
    { "id": "projekt", "name": "Projekt" },
    { "id": "lernen", "name": "Lernen" }
  ],
  "lists": {
    "<todoTaskListId>": { "area": "homelab", "maxTasks": 3, "motivation": "…" }
  },
  "tasks": {
    "<todoTaskId>": { "type": "lernen", "motivation": "…" }
  }
}
```

- `version` für spätere Migrationen.
- Einträge zu Listen oder Tasks, die in To Do nicht mehr existieren oder erledigt sind, werden in der Einstellungsansicht als verwaist angezeigt und können gesammelt entfernt werden. Die App löscht sie nie selbständig.
- Wird ein Typ gelöscht, der noch Tasks zugeordnet ist, fragt die App nach (Tasks auf „Sonstige“ setzen oder abbrechen).

## Grafische Designs

- Jedes Design ist ein **Theme** in einer eigenen Datei unter `themes/`.
- Ein Theme besteht aus CSS-Variablen (Hintergrund, Schrift, Linien, Tooltip usw.) und einer Farbpalette für die Bereiche.
- Die Zeichenlogik verwendet ausschliesslich diese Variablen und die Palette; keine fest codierten Farben.
- Auswahl über die Einstellungsansicht, gespeichert in der Konfiguration (`theme`).
- In v1 umsetzen: **ein helles und ein dunkles Theme**.
- Das **helle Theme** orientiert sich an der früheren Offline-Version: warmer Papierton als Hintergrund (`#f4f1eb`) mit leichter Rauschtextur, dunkle Tinte (`#1a1814`), roter Akzent (`#c0392b`), Schriften *Syne* (Überschriften) und *Syne Mono* (Text) über Google Fonts. Palette: `#c0392b #1a5e8a #2c7a4b #8e44ad #d35400 #16a085 #b7950b #717d7e`.

## Entwicklungsablauf

- Entwicklung auf einem Branch `dev`, lokal unter `http://localhost` testen.
- Nur funktionierende Stände in `main` übernehmen; `main` wird veröffentlicht.
- Keine echten Aufgaben, Listennamen oder Konfigurationsdaten ins Repository committen (Repository kann öffentlich sein). Für Tests mit Beispieldaten arbeiten.
- Ein Modus mit **Beispieldaten ohne Anmeldung** ist erwünscht, damit Darstellung und Themes ohne Microsoft-Konto entwickelt werden können.
- Beispieldaten sind **frei erfunden** (z.B. Bereiche „Beruf“, „Haushalt“, „Freizeit“). Inhalte aus der früheren Offline-Version oder aus dem echten To Do werden nicht übernommen.

## Noch zu prüfen

- Wie gross darf die Notiz eines To-Do-Tasks über die API werden? Test: ca. 20 000 Zeichen schreiben und wieder lesen. Falls zu knapp: Konfiguration auf mehrere Tasks verteilen. Wichtig, weil `tasks` mit jedem Typ und jeder Motivation wächst.
- Behält ein Task seine `id`, wenn er in eine andere Liste verschoben wird? Sonst gehen Typ und Motivation beim Verschieben verloren (bzw. werden verwaist).
- Wie verändert To Do HTML-Inhalt in der Notiz beim Bearbeiten in der App?

## Nicht in v1

- „Mein Tag“, Outlook-Von-bis-Zeiten
- Abhängigkeiten zwischen Tasks / Graph-Ansicht pro Projekt
- Routinen mit Zeitbudget
- Konfiguration in OneDrive
- Anderes Backend (z.B. Vikunja) – die Schichtentrennung soll das aber vorbereiten

# Beurteilung mündlicher Prüfungen

Statisches, GitHub-Pages-fähiges Formular auf Basis der PDF-Vorlage `MündlichePrüfungsbeurteilung`.

## Funktionen

- Fünf Bewertungskriterien aus der Vorlage
- Klickbares Punkteraster von `1` bis `5`
- Kurze Orientierungshilfe zu jedem Kriterium
- Automatische Notenberechnung auf Basis des Punktedurchschnitts
- Gleichgewichtete Kriterien
- Einstellbare Rundung: `0.5`, `0.25` oder `0.1`
- Kommentar- und Namensfeld
- Export der Beurteilung als JSON-Datei
- Druckansicht beziehungsweise Speichern als PDF über den Browser
- Lokales Zwischenspeichern im Browser

## Berechnung

Die Punkte werden direkt übernommen:

| Punkte | Orientierung |
| ---: | --- |
| `1` | nicht erfüllt |
| `2` | ansatzweise erfüllt |
| `3` | grundsätzlich erfüllt |
| `4` | gut erfüllt |
| `5` | sehr gut erfüllt |

Die Endnote ist der Durchschnitt aller bewerteten Kriterien und wird standardmäßig auf halbe Punkte gerundet.

## GitHub Pages

1. Die Dateien `index.html`, `styles.css`, `app.js` und `README.md` in ein GitHub-Repository hochladen.
2. In den Repository-Einstellungen unter **Pages** die Veröffentlichung aus dem Branch `main` aktivieren.
3. Die veröffentlichte Seite im Browser öffnen.

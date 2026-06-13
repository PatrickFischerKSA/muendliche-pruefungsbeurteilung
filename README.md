# Beurteilung mündlicher Prüfungen

Statisches, GitHub-Pages-fähiges Formular auf Basis der PDF-Vorlage `MündlichePrüfungsbeurteilung`.

## Funktionen

- Fünf Bewertungskriterien aus der Vorlage
- Klickbare Stufen `--`, `-`, `0`, `+`, `++`
- Automatische Notenberechnung auf einer Schweizer Skala von `1` bis `6`
- Gleichgewichtete Kriterien
- Einstellbare Rundung: `0.5`, `0.25` oder `0.1`
- Kommentar- und Namensfeld
- Druckansicht beziehungsweise Speichern als PDF über den Browser
- Lokales Zwischenspeichern im Browser

## Berechnung

Die Stufen werden linear auf die Notenskala übertragen:

| Stufe | Wert |
| --- | ---: |
| `--` | 1 |
| `-` | 2.25 |
| `0` | 3.5 |
| `+` | 4.75 |
| `++` | 6 |

Die Endnote ist der Durchschnitt aller bewerteten Kriterien und wird standardmäßig auf halbe Noten gerundet.

## GitHub Pages

1. Die Dateien `index.html`, `styles.css`, `app.js` und `README.md` in ein GitHub-Repository hochladen.
2. In den Repository-Einstellungen unter **Pages** die Veröffentlichung aus dem Branch `main` aktivieren.
3. Die veröffentlichte Seite im Browser öffnen.

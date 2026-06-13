# Beurteilung mündlicher Prüfungen

Statisches, GitHub-Pages-fähiges Formular auf Basis der PDF-Vorlage `MündlichePrüfungsbeurteilung`.

## Funktionen

- Fünf Bewertungskriterien aus der Vorlage
- Klickbares Punkteraster von `1` bis `5`
- Kurze Umschreibungen der Punktwerte direkt in den Klickfeldern
- Kurze Orientierungshilfe zu jedem Kriterium
- Automatische Umrechnung des Punktedurchschnitts ins Schweizer Notensystem `1` bis `6`
- Gleichgewichtete Kriterien
- Mathematische Rundung auf halbe Noten
- Kommentar- und Namensfeld
- Export der Beurteilung als JSON-Datei
- Druckansicht beziehungsweise Speichern als PDF über den Browser
- Lokales Zwischenspeichern im Browser

## Berechnung

Die Punkte werden zuerst gemittelt und dann linear ins Schweizer Notensystem umgerechnet:

```text
Note = 1 + ((Punktedurchschnitt - 1) * 5 / 4)
```

Damit gilt:

| Punkte | Orientierung |
| ---: | --- |
| `1` | kaum tragfähig |
| `2` | lückenhaft |
| `3` | solide Basis |
| `4` | überzeugend |
| `5` | eigenständig stark |

Ein Punktedurchschnitt von `1` ergibt Note `1`, ein Punktedurchschnitt von `5` ergibt Note `6`. Die Endnote wird mathematisch auf halbe Noten gerundet.

## GitHub Pages

1. Die Dateien `index.html`, `styles.css`, `app.js` und `README.md` in ein GitHub-Repository hochladen.
2. In den Repository-Einstellungen unter **Pages** die Veröffentlichung aus dem Branch `main` aktivieren.
3. Die veröffentlichte Seite im Browser öffnen.

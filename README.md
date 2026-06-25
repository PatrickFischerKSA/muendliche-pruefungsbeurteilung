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
- Zweite Version mit Upload, Aufnahme, Transkript und Backend-Anschluss unter `ki-version/`
- Material-Upload in der KI-Version für PDF und Word (`.docx`, `.doc`)

## Backend starten

Für Transkription und KI-Bewertung braucht die KI-Version ein Backend:

```bash
cp .env.example .env
npm install
npm start
```

Danach in der KI-Version als Backend-Endpunkt eintragen:

```text
http://localhost:8787/api/muendliche-pruefung
```

## Vercel

Die App ist für Vercel vorbereitet. Die KI-Version verwendet auf Vercel automatisch den Endpunkt:

```text
/api/muendliche-pruefung
```

Der OpenAI-Schlüssel gehört nicht in den Code, sondern als Environment Variable in Vercel:

```text
OPENAI_API_KEY
```

Optionale Modellvariablen:

```text
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_EVAL_MODEL=gpt-5-mini
```

Nach dem Setzen oder Ändern der Environment Variables muss ein neues Production Deployment ausgelöst werden.

## Berechnung

Die Punkte werden zuerst gemittelt und dann linear ins Schweizer Notensystem umgerechnet:

```text
Note = 1 + ((Punktedurchschnitt - 1) * 5 / 4)
```

Die Umschreibungen der Werte sind kriterienspezifisch formuliert:

| Kriterium | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Eigene Interpretation / Erklärungsansätze | keine Deutung | vage Ansätze | plausibel | eigenständig | originell fundiert |
| Gesprächsentwicklung | blockiert | reagiert knapp | entwickelt mit | denkt weiter | führt souverän |
| Antworten auf Fragen | weicht aus | teilweise passend | meist treffend | klar und flexibel | präzis und sicher |
| Argumentationsfähigkeit | unbegründet | lose Behauptungen | nachvollziehbar | schlüssig belegt | stringent verknüpft |
| Sprache | unklar | stockend | verständlich | präzise | gewandt |

Ein Punktedurchschnitt von `1` ergibt Note `1`, ein Punktedurchschnitt von `5` ergibt Note `6`. Die Endnote wird mathematisch auf halbe Noten gerundet.

## GitHub Pages

1. Die Dateien `index.html`, `styles.css`, `app.js` und `README.md` in ein GitHub-Repository hochladen.
2. In den Repository-Einstellungen unter **Pages** die Veröffentlichung aus dem Branch `main` aktivieren.
3. Die veröffentlichte Seite im Browser öffnen.

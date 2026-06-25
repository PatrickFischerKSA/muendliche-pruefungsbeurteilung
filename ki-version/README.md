# KI-Version der mündlichen Prüfungsbeurteilung

Diese zweite Version erweitert die manuelle Beurteilung um:

- Upload für Textstelle als PDF oder Word-Datei (`.docx`, `.doc`)
- Upload für das gesamte Werk als PDF oder Word-Datei (`.docx`, `.doc`)
- integrierter Prüfungsablauf: Starten, Stoppen, automatische Transkription und Bewertung
- Audioaufnahme im Browser
- Transkriptfeld mit optionalem Live-Transkript über die Browser-Spracherkennung
- Vorbereitung für Transkription und KI-Bewertung über einen Backend-Endpunkt
- Bewertung nach denselben fünf Kriterien wie die erste Fassung
- Bewertung mit hinterlegten Interpretationsparadigmen zu Argumentationslehre und literarischer Textkommentierung
- Export als JSON

## Wichtiger Architekturhinweis

Eine reine GitHub-Pages-Seite kann aufnehmen und Dateien auswählen, aber sie sollte keine API-Schlüssel enthalten. Transkription und KI-Bewertung müssen deshalb über einen eigenen Backend-Endpunkt laufen.

Die Seite sendet `multipart/form-data` an den eingetragenen Endpunkt. Im integrierten Ablauf wird nach `Prüfung beenden & auswerten` zuerst `task=transcribe` und danach automatisch `task=evaluate` aufgerufen.

Wenn das mitgelieferte Backend aus diesem Repository läuft, lautet der Endpunkt:

```text
http://localhost:8787/api/muendliche-pruefung
```

Auf Vercel wird der Endpunkt automatisch aus der aktuellen Domain gesetzt:

```text
/api/muendliche-pruefung
```

Der OpenAI API-Key muss in Vercel als Environment Variable `OPENAI_API_KEY` gesetzt werden. Er darf nicht im Frontend oder Repository gespeichert werden.

## Erwartete Backend-Antwort

Für `task=transcribe`:

```json
{
  "transcript": "..."
}
```

Für `task=evaluate`:

```json
{
  "transcript": "...",
  "overallComment": "...",
  "assessment": [
    {
      "criterion": "Eigene Interpretation / Erklärungsansätze",
      "score": 4,
      "comment": "Kurze Begründung mit Bezug auf das Transkript."
    }
  ]
}
```

Die Punktwerte bleiben `1` bis `5`; daraus wird im Frontend die Schweizer Note `1` bis `6` mit mathematischer Rundung auf halbe Noten berechnet.

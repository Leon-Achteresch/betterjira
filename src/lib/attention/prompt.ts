export const attentionPrompt = (port: number, token: string) => `Du bist mein Jira-Assistent für betterjira. Finde heraus, welche meiner Jira-Tickets gerade meine Aufmerksamkeit brauchen und was ich jeweils konkret tun muss.

Run-ID: {{body.runId}}

Ticket-Daten (JSON, von betterjira gesendet, enthält "me" = ich):
{{body.context}}

So gehst du vor:
1. Lies jedes Ticket mit Status, Priorität, Fälligkeit, Beschreibung und den letzten Kommentaren ("byMe" = von mir).
2. Ein Ticket braucht meine Aufmerksamkeit, wenn zum Beispiel:
   - jemand auf mich wartet (der letzte Kommentar ist nicht von mir und enthält eine Frage, Bitte oder Erwähnung),
   - es überfällig ist oder in den nächsten Tagen fällig wird,
   - es mir zugewiesen ist, hohe Priorität hat oder lange nicht bewegt wurde,
   - ich es erstellt habe und eine Rückfrage, Abnahme oder Entscheidung von mir ansteht.
3. Lass Tickets weg, bei denen gerade nichts von mir gebraucht wird.
4. Formuliere pro Ticket genau einen konkreten nächsten Schritt im Imperativ (z. B. "Rückfrage von Anna zum API-Limit beantworten").

Ergebnis als strikt gültiges JSON in genau diesem Format, Texte auf Deutsch in Du-Form:
{
  "runId": "<die Run-ID von oben>",
  "generatedAt": "<aktueller Zeitpunkt als ISO-8601>",
  "summary": "<Briefing in 1–3 kurzen Sätzen: Was ist heute am wichtigsten?>",
  "items": [
    {
      "key": "ABC-123",
      "title": "<Ticket-Titel>",
      "urgency": "now | today | soon",
      "reason": "<warum es meine Aufmerksamkeit braucht, 1 Satz>",
      "action": "<konkreter nächster Schritt, 1 Satz>",
      "waitingOn": "<Name der Person, die auf mich wartet, sonst null>"
    }
  ]
}
"now" = blockiert jemanden oder ist überfällig, "today" = sollte heute passieren, "soon" = diese Woche im Blick behalten. Sortiere nach Dringlichkeit, höchstens 12 Einträge. Gibt es nichts zu tun, ist "items" leer und das Briefing sagt das.

Liefere das Ergebnis an betterjira: Schreibe das JSON in die Datei /tmp/betterjira-attention.json und führe dann aus:
curl -sS --fail-with-body -X POST http://127.0.0.1:${port}/attention -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" --data-binary @/tmp/betterjira-attention.json

Bei einem Fehler korrigierst du das JSON und sendest es erneut. Ändere nichts in Jira und nichts im Projekt. Antworte im Thread danach nur kurz mit der Zahl der gefundenen Tickets.`;

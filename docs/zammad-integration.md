# Zammad-Integration

Unter **Einstellungen → Verbindungen → Zammad** eine HTTPS-Instanz und einen persönlichen API-Token hinterlegen. Der native Client prüft `/api/v1/users/me`, bevor er die Verbindung im bestehenden sicheren Gerätespeicher ablegt. Der Token verlässt den nativen Prozess nur als Authorization-Header an diese Instanz. Für die Ticketbearbeitung benötigt der Token `ticket.agent` sowie passende Gruppenrechte. Optionale Funktionen können zusätzliche Rechte erfordern; ein Fehler dort blockiert den Verlauf nicht.

## Funktionsumfang

Direkt in betterjira verfügbar:

- „Zammad-Tickets“ mit Suche, offenen/eigenen/allen Tickets und nachladbaren Seiten
- Erstellen und Bearbeiten von Tickets: Titel, Status, Priorität, Gruppe, Zuständiger, Kunde, Wiedervorlage und Ticketnotiz
- Artikelverlauf mit internen/öffentlichen Notizen, Telefonnotizen und E-Mail-Antworten mit Empfänger und CC
- Anhänge beim Antworten (zusammen 20 MB) und authentifizierter Download (25 MB)
- Tags inklusive optimistischem Entfernen, Rollback und Rückgängig-Aktion
- Ticket-Verknüpfungen über öffentliche Ticketnummern
- Lesen und Buchen von Zeiteinheiten entsprechend der Instanz-Konfiguration
- Jira-Verweise aus „Helpdesk Ticketnummer“ und „Helpdesk Ticket“, unabhängig von den benutzerdefinierten Feld-IDs; auch strukturierte Feldwerte und Jira-Wiki-Links
- Markenlogos aus `@thesvg/react`

**Keine vollständige native Nachbildung der Zammad-Oberfläche:** Administration, Makros, Zusammenführen/Löschen, Checklisten, Shared Drafts, Erwähnungsverwaltung, benutzerdefinierte Objektfelder sowie Spezialkanäle werden weiterhin im Originalsystem bedient. „In Zammad öffnen“ führt direkt zum jeweiligen Ticket. Die Anmeldung im Browser ist unabhängig vom API-Token. Die Funktionen hängen von Version, Gruppenrechten, Core Workflows und aktivierten Modulen der Instanz ab.

HTML-Artikel werden mit DOMPurify bereinigt und in einem iframe mit Sandbox und restriktiver Content Security Policy dargestellt. Skripte, externe Bilder und Tracking-Ressourcen sind gesperrt. Anhänge bleiben separat herunterladbar. Schreibzugriffe werden bei Fehlern nicht automatisch wiederholt. Unklare Netzwerkfehler beim Senden sollten vor einem erneuten Versuch in Zammad geprüft werden.

## Ticketoberfläche und Personen

Zammad-Tickets öffnen neben Jira-Vorgängen in derselben Tab-Leiste, einschließlich Anheften, Schließen, Hintergrund-Öffnen und Tastaturwechsel. Die öffentliche Nummer wird als Tab-Titel angezeigt. In schmalen Fenstern stehen dieselben Tickets im Menü „Weitere Aktionen“.

Der Verlauf zeigt Namen, Profilbilder, Zeiten und interne Kennzeichnung ohne separate Karten pro Artikel. Personen werden über `/users/{id}` aufgelöst; ihre Bild-Hashes werden über den nativen Client von `/users/image/{hash}` geladen. Namen und Adressen werden getrennt dargestellt. Fehlt ein Bild oder der Zugriff darauf, erscheinen Initialen in gleicher Zielgröße. Die Fotos in den Mock-Screenshots sind ausschließlich Beispielbilder.

Der Editor unterscheidet „Interner Kommentar“, „E-Mail“, „Telefonnotiz“ und „Öffentlicher Kommentar“. Eine Antwortaktion erscheint nur an beantwortbaren öffentlichen Nachrichten. Sie setzt Empfänger, Betreff und bei vorhandener Message-ID den Antwortbezug. Ausgehende E-Mails werden mit ihrem Empfänger fortgesetzt, nicht mit der eigenen Absenderadresse. Interne Kommentare haben keine Antwortaktion. Kommentarentwürfe, Dateiauswahl und E-Mail-Bezüge bleiben während der App-Sitzung beim Tab-Wechsel erhalten. Ein Verbindungswechsel verwirft diese Entwürfe.

Status, Priorität und Gruppe werden per Menü sofort mit optimistischem Update und Rollback gespeichert. Titel und Ticketnotiz speichern beim Verlassen des Felds. Die übrigen Funktionen stehen in kompakten Eigenschaften und Popovern.

## Fehlender Token-Zugriff

Die Einrichtung setzt keinen sichtbaren Menüpunkt voraus. Fehlt „Token-Zugriff“ im Zammad-Profil, muss ein Administrator unter System → API den Token-Zugriff aktivieren und der Benutzerrolle `user_preferences.access_token` geben. Token und Benutzer brauchen zusätzlich die erforderlichen Ticket- und Gruppenrechte. Diese Freigabe kann betterjira nicht umgehen.

Referenz: https://admin-docs.zammad.org/de/latest/system/api.html

## Jira-Verknüpfung

Die öffentliche Ticketnummer (etwa `20043776`) wird über `/tickets/search?query=number:20043776` aufgelöst und anschließend exakt verglichen. Sie ist **keine API-ID**. Die interne ID aus einem `#ticket/zoom/41`-Link wird nur bei passender gespeicherter Instanz verwendet. Nummer und Link aus den beiden Jira-Feldern werden zu einem Verweis zusammengeführt. Ein Verweis ohne gespeicherte Verbindung führt zur Einrichtung.

## Validierung ohne Zugangsdaten

Alle API-Zugriffe laufen durch Effect und Antwortschemas, React verwendet TanStack Query. `tests/browser/mock-zammad.js` simuliert die nativen Kommandos mit Zustandsänderungen und Fehlerfällen, ohne echte Tokens oder Netzwerkzugriff auf eine Zammad-Instanz.

```sh
bun run test --maxWorkers=2
E2E_BROWSER_CHANNEL=chromium bunx playwright test tests/browser/zammad.e2e.ts tests/browser/zammad-design.e2e.ts --workers=1 --output=/tmp/betterjira-zammad-browser-results
cargo test --manifest-path src-tauri/Cargo.toml zammad::tests --lib
bun run build
```

Mock-Ansichten im Vite-Entwicklungsserver:

- `/tests/browser/fixture.html?scenario=zammad&route=/helpdesk`
- `/tests/browser/fixture.html?scenario=zammad&route=/helpdesk/41`
- `/tests/browser/fixture.html?scenario=zammad&route=/issue/DEMO-1`
- `/tests/browser/fixture.html?scenario=zammad-unconnected&route=/settings/verbindungen`

Ein Live-Test mit einer echten Zammad-Instanz und ihren Core Workflows ist ohne Token nicht erfolgt.

API-Referenz: https://docs.zammad.org/en/latest/api/intro.html

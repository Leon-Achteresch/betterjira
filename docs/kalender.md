# Kalender und Outlook

Die Seite **Kalender** ist über die Sidebar unter `/kalender` erreichbar, auch ohne Jira-Anmeldung. Rollouts enthalten Titel, Beginn und Ende, Notizen, verknüpfte Tickets und eine optionale Outlook-Erinnerung. Die Uhrzeiten werden in der lokalen Zeitzone eingegeben und als UTC-Zeitpunkte gespeichert.

Ein Klick auf einen Tag zeigt dessen Agenda. Ein Doppelklick plant dort einen Rollout. Über die Agenda lassen sich Rollouts bearbeiten und löschen; die Liste der nächsten Rollouts springt zum jeweiligen Tag. Tickets können nach Schlüssel oder Text gesucht werden. Ticketlinks der aktuell verbundenen Jira-Site öffnen sich direkt in betterjira. Bei einem Wechsel der Jira-Site bleiben vorhandene Links erhalten; Tickets anderer Sites können nicht versehentlich zum selben Rollout hinzugefügt werden.

## Outlook ohne App-ID

**Outlook verbinden** verwendet das lokal installierte **klassische Outlook unter Windows** mit einem eingerichteten Profil. betterjira benötigt weder eine Microsoft-Entra-App-ID noch ein Client Secret oder eine eigene Microsoft-Anmeldung. Outlook selbst muss bereits mit dem gewünschten Konto angemeldet sein und kann bei einer abgelaufenen Sitzung oder einem Office-Kontoproblem einen eigenen Microsoft-Anmeldedialog anzeigen. Das neue Outlook, Outlook im Browser und Outlook auf macOS unterstützen diese lokale COM-Anbindung nicht. Rollouts bleiben auf diesen Plattformen lokal nutzbar.

Bei `AADSTS50020` zeigt die Microsoft-Fehlermeldung das verwendete Konto und den Zielmandanten. Stimmen diese nicht zusammen, muss die Anmeldung in Outlook bzw. Office für das gewünschte Konto und die passende Organisation korrigiert werden. Ein erfolgreicher lokaler COM-Zugriff bestätigt nicht, dass die Microsoft-Anmeldung und Serversynchronisation des Outlook-Profils ebenfalls funktionieren. betterjira ändert keine Office-Konten oder Mandanteneinstellungen.

Die Verbindung verwendet ausschließlich eine bereits geöffnete klassische Outlook-Instanz und deren Standardkalender. Öffne klassisches Outlook zunächst selbst und prüfe, dass dein Kalender dort erreichbar ist. betterjira startet Outlook nicht automatisch und ruft keine Profilanmeldung auf. Ist keine laufende Instanz verfügbar, erscheint ein Hinweis zum manuellen Öffnen. Der Kalender zeigt zusätzlich dessen Termine einschließlich Serien und ganztägiger Termine. Änderungen in Outlook werden beim erneuten Laden der Kalenderdaten bzw. bei erneutem Fensterfokus eingelesen.

Ein Rollout wird durch **Mit Outlook synchronisieren** als Termin mit Notizen, Ticketlinks und Erinnerung angelegt. Wiederholtes Synchronisieren aktualisiert denselben Termin. Lokale Änderungen werden erst durch **Erneut synchronisieren** nach Outlook übertragen. Änderungen am Outlook-Termin werden nicht automatisch in den lokalen Rollout zurückgeschrieben. **Keine Erinnerung** schaltet die Outlook-Erinnerung ab. Für ausschließlich lokale Rollouts erfolgt keine Systembenachrichtigung.

**In Outlook öffnen** öffnet den Termin im klassischen Outlook. Beim Löschen eines verknüpften Rollouts wird auch der Outlook-Termin gelöscht. Schlägt der Outlook-Zugriff fehl, bleibt der lokale Rollout erhalten. Dafür muss das ursprüngliche Outlook-Profil verbunden sein. Nachträglich zu Besprechungen oder Serien umgewandelte Rollouts werden vor Überschreiben und Löschen geschützt und müssen direkt in Outlook bearbeitet werden. Das Trennen der Verbindung entfernt keine Termine oder Rollouts.

Die Rollouts liegen im lokalen App-Speicher unter `betterjira:calendar:rollouts:v1`. Die Verbindung speichert ausschließlich die Outlook-Kalender-ID unter `betterjira:calendar:outlook:v1`, keine Zugangsdaten. Die COM-Kommunikation läuft über einen verborgenen PowerShell-Prozess mit festem Skript, JSON-Eingabe und 45 Sekunden Zeitlimit. Nutzereingaben werden nicht als PowerShell-Code ausgeführt.

## Prüfungen

```sh
bun run test
bun run build
bun run test:e2e
bun run test:outlook
```

Die E2E-Prüfung verwendet Microsoft Edge und eine lokale Tauri-/Jira-/Outlook-Simulation. Sie prüft Anlegen, Pflichtfelder, Zeiträume, Ticketverknüpfung und Navigation, Neuladen, Bearbeiten, Löschen, Monats- und Tagesauswahl, Offline-Nutzung, Outlook-Verbindung ohne App-ID, Synchronisieren, Fehler und Wiederholung sowie Trennen. Sie läuft mit 1440 px in heller Darstellung und 760 px in dunkler Darstellung mit reduzierter Bewegung. Es werden keine echten Jira-Tickets geändert.

`test:outlook` ist ein echter Integrationstest gegen den Standardkalender des lokalen klassischen Outlook. Er erstellt einen eindeutig als Test gekennzeichneten Termin im Jahr 2099 und entfernt ihn anschließend aus dem Kalender. Er prüft Profilzugriff, Erstellen, wiederholten Sync ohne Duplikate, Bearbeiten, UTC-Zeiten, Unicode und Sonderzeichen, Ticketlinks, Erinnerungen und deren Abschaltung, Serienexpansion, Eigentums- und Serienschutz sowie wiederholtes Löschen.

Die Prüfung der Anbindung ohne Kalenderzugriff läuft mit `powershell.exe -NoProfile -NonInteractive -STA -File tests/native/outlook.integration.ps1`. Sie prüft mit simulierten Instanzen die Wiederverwendung einer laufenden Sitzung, fehlende und leere Sitzungen sowie den Ausschluss eines automatischen Outlook-Starts. Der Live-Test setzt nun ein bereits geöffnetes klassisches Outlook voraus. Bei einem ungeklärten Office-Anmeldefehler sollte zunächst nur die Prüfung ohne Kalenderzugriff ausgeführt werden.

Nach der Korrektur des automatischen Outlook-Starts bestanden 168 Unit-Tests, die native Prüfung ohne Kalenderzugriff und vier gezielte E2E-Prüfungen der Verbindung sowie der Office-Mandanten- und Sitzungsfehler (hell und dunkel mit reduzierter Bewegung). Der Frontend-Produktionsbuild war erfolgreich. Der erneute Rust-Testlauf bleibt durch den fehlenden MSVC-Linker blockiert; die eingebettete PowerShell-Änderung wird erst nach einem nativen Neubuild in der Desktop-App wirksam. Wegen des gemeldeten Office-Anmeldefehlers wurde der schreibende Outlook-Live-Test nicht erneut ausgeführt.

Am 06.11.2026 bestanden 167 Unit-Tests, alle 18 E2E-Tests und der Outlook-Live-Test. TypeScript und der Produktionsbuild waren erfolgreich. Der native Rust-Testlauf konnte auf diesem Rechner wegen des fehlenden MSVC-Linkers `link.exe` nicht kompiliert werden. Dafür sind Visual Studio Build Tools mit den C++-Werkzeugen erforderlich. Die neuen Rust-Tests prüfen Request-Validierung, JSON-Datenübergabe und Antwortvalidierung; das PowerShell-Skript wurde zusätzlich direkt gegen das vorhandene Outlook-Profil getestet. Der bekannte Hinweis auf einen großen JavaScript-Hauptchunk sowie der bestehende Effect-Sprachdiensthinweis in `jira/queries.ts` bleiben bestehen.

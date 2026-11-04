# UX-Prüfung am Arbeitsalltag

Drei unabhängig arbeitende Subagenten haben den vorhandenen Code aus den Perspektiven Vielnutzer, sorgfältiger Gelegenheitsnutzer und KI-Nutzung durchgespielt. Anschließend wurden die wichtigsten Abläufe in der echten React-Oberfläche mit lokalen Jira-/Tauri-Testdaten ausgeführt. Das sind Szenario-Walkthroughs, keine Interviews mit beobachteten echten Nutzern.

## Das einfache Bedienmodell

- **Ticket lesen:** Beschreibung und Kommentare stehen im Vordergrund. Die kleine Ticketleiste bleibt beim Scrollen erreichbar.
- **Unterbrochen werden:** Einfach ein anderes Ticket öffnen. Die Lesestelle wird lokal gemerkt.
- **Zurückkommen:** „Weiterarbeiten“ zeigt letzte Tickets, angeheftete Arbeit und angefangene Entwürfe. Auch ein Wort aus einer privaten Notiz findet das Ticket wieder.
- **Gedanken festhalten:** Unter „… → Private Notiz für später“ den nächsten Schritt notieren. Diese Notiz wird nicht in Jira veröffentlicht.
- **Bearbeiten:** Text- und Beschreibungsentwürfe bleiben beim Wechsel erhalten. „Entwurf fortsetzen“ greift sie wieder auf; erst „Speichern“ schreibt nach Jira.
- **Selteneres erledigen:** Details, Anhänge, Zeit und Entwicklung liegen im Drawer bzw. Aktionsmenü.
- **KI verwenden:** Drei nächste Schritte bilden den Einstieg. Begründungen und weitere Vorschläge stehen im Briefing-Drawer. Die KI macht Vorschläge; Änderungen an Tickets bleiben deine Aktion.

## Was weniger geworden ist

| Stelle | Vorher | Jetzt |
| --- | --- | --- |
| Ticketkopf | Sieben gleichrangige Icon-Aktionen | Details, Pin und ein beschriftetes Drei-Punkte-Menü |
| Lesestrecke | Entwicklungseinrichtung und zusätzliche Felder zwischen Beschreibung und Kommentaren | Zusatzfunktionen im Drawer |
| Kommentarbox | Drei Vorlagen und technische Syntax ständig sichtbar | Ruhige Textarea; Werkzeuge bei Fokus/Entwurf, Vorlagenmenü, Hilfe im Tooltip |
| Ergebnisliste | Sieben Schnellfilter gleichzeitig | Zwei häufige Filter; Rest im Menü, aktive Zusatzfilter bleiben entfernbar |
| Startseite mit vielen Tickets | Lange vollständige Arbeitsliste | Sechs Tickets pro Hauptabschnitt, „Alle anzeigen“ bei Bedarf |
| KI-Briefing | Bis zu zwölf ausführliche Karten | Höchstens drei kompakte Vorschläge; Erklärung und Rest im Drawer |
| Startseite | Prominentes Abmelden | Direkter Einstieg zum zuletzt bearbeiteten Ticket; Abmelden bleibt im Kontomenü |

Statuswechsel tragen jetzt ein erkennbares Statussymbol und animieren den tatsächlichen Wechsel. Die Oberfläche zeigt keine erfundenen Analyseprozente. Bewegungen bleiben kurz genug zum Weiterarbeiten; Ergebniswechsel sind etwas ruhiger animiert. Reduced Motion gilt auch für die äußeren Drawer. Auf schmalen Fenstern nutzen Drawer die volle Breite.

## Durchgespielte Abläufe und Befunde

| Szenario | Konkreter Ablauf | Ergebnis |
| --- | --- | --- |
| Vielnutzer | 35 vorbereitete Ticketkontexte, Liste durchsuchen und eine alte Notiz über „Lea“ finden | 35 Einträge ohne neue Tab-Leiste; Liste scrollt im Drawer, Treffer zeigt den gemerkten Kontext |
| Leser mit Unterbrechung | Langes Ticket A bis Scrollposition 1.150 lesen → Ticket B über Suche öffnen → A über Weiterarbeiten öffnen | B beginnt oben; A kehrt nachweislich auf Position 1.150 zurück |
| Private Wiedereinstiegsnotiz | Nächsten Schritt im Notiz-Tab schreiben | Lokal gespeichert; kein Jira-Schreibzugriff |
| Langsamer Bearbeiter | Beschreibung beginnen → anderes Ticket → später nach A zurück → Entwurf fortsetzen | Ursprünglicher Text bleibt vollständig erhalten, bis explizit gespeichert oder verworfen wird |
| Abschließen | Wiederhergestellten Beschreibungsentwurf mit ⌘ + Enter speichern; danach Status auf Erledigt ändern | Eine PUT-Anfrage für den Entwurf; Entwurf geleert. Eine Transition-Anfrage; Status und gemerkter Kontext aktualisiert |
| Bewusst wenige Entscheidungen | Leere Kommentarbox ansehen und danach fokussieren | Anfangs nur Textarea; notwendige Werkzeuge erscheinen beim Schreiben |
| KI-Überblick | Acht Vorschläge laden | Drei Vorschläge im Einstieg; acht mit Begründungen und Analyseumfang im Drawer |
| KI-Fehler | Einen Agentenstart scheitern lassen | Sichtbarer Fehlerstatus, bestehende drei Vorschläge bleiben verfügbar |
| KI und Unterbrechung | Erneut starten → zwei schnelle Auslösungen → Ticket öffnen → zurück zur Startseite | Genau ein Lauf; fertig eingetroffenes Ergebnis wird auch außerhalb der Startseite empfangen |
| Tastatur | Weiterarbeiten bzw. Details öffnen → Escape | Fokus kehrt zur auslösenden Aktion zurück; kein erzwungener Sprung der Lesestrecke |
| Schmale Darstellung | 390 × 844, dunkel, 35 Ticketkontexte | Drawer 390 px breit, kein horizontaler Seitenüberlauf, interner Listenscroll |
| Reduzierte Bewegung | Simulierte JS-Medienpräferenz in der Fixture | Drawer-Außenanimation ist `none`; Bewegungsvarianten verwenden die reduzierte Darstellung |

Die Feldentwürfe haben eine Revisionskennung. Nach erfolgreichem Speichern wird nur die tatsächlich gesendete Revision entfernt. Ein während der Anfrage weitergeschriebener Entwurf bleibt erhalten. Eine Sperre pro Feld verhindert parallele Schreibanfragen beim schnellen Wiederöffnen im selben Fenster.

Der Verlauf hält 50 Tickets. Reine Lesekontexte werden ebenfalls begrenzt. Pins, Notizen und angefangene Kommentar-/Feldentwürfe bleiben davon unabhängig erreichbar. Einträge zeigen den beim letzten Öffnen gesehenen Status; der Tooltip benennt diesen Zeitpunkt ausdrücklich.

## KI-Verlässlichkeit

- Analysezustände unterscheiden Laden, laufende Analyse, Ergebnis, Fehler und ausstehende Antwort.
- Ein echter Timer löst nach 15 Minuten ohne Ergebnis den Timeout-Zustand aus; dafür muss niemand die Seite neu rendern oder neu öffnen.
- Ein Lauf beginnt erst mit gültigem Webhook und bereitem lokalem Rückkanal.
- Manuelle und automatische Auslösung teilen die Sperre des laufenden Auftrags.
- Ergebnisse werden nur bei bekannter Zuordnung zu Jira-Instanz und Konto angezeigt. Alte Ergebnisse ohne Zuordnung verlangen eine neue Analyse.
- Das UI erklärt die vorhandene Begrenzung auf 50 offene relevante Tickets und gekürzte Beschreibungen/Kommentare im Detail-Drawer.
- Das fertige Ergebnis wird zentral in der App empfangen, auch wenn gerade ein Ticket geöffnet ist.

Die Browserprüfung simuliert den Agenten und die Jira-Antworten. Qualität echter Modellvorschläge, reale Webhooks und individuelle Jira-Berechtigungen wurden dabei nicht bewertet. Das native Backend besitzt weiterhin eine einzige Ergebnisdatei; die Kontozuordnung im UI ersetzt keine vollständig getrennte parallele Ergebnisablage.

## Technische Prüfung und verbleibende Grenzen

103 Tests in 13 Dateien erfolgreich. TypeScript und Produktionsbuild erfolgreich. Die mechanische UI-Prüfung meldete keine Befunde. Der bestehende Hinweis zu einem großen JavaScript-Bundle und ein nicht blockierender Effect-Hinweis sind weiterhin vorhanden.

Text- und Wiki-/Beschreibungsentwürfe sind geschützt; Zahlen-, Datums- und Benutzerfelder behalten ihr bisheriges Verhalten. Fremde Änderungen vom Jira-Server werden nicht automatisch mit lokalen Entwürfen zusammengeführt. Die Lesestelle ist pixelbasiert und kann bei stark verändertem Inhalt oder anderer Fensterbreite nur näherungsweise dem vorherigen Absatz entsprechen. Lokale Kontexte werden nicht zwischen Geräten synchronisiert.

Die reproduzierbaren Testzugänge stehen in [tests/browser/README.md](../tests/browser/README.md).

# Release-Rhythmus

Aktuelle Anweisung vom 7. November 2026: Für den bestehenden Backlog zuerst sämtliche offenen PRs integrieren und gemeinsam testen, anschließend ein gemeinsames Release starten. Während dieser Integration werden keine Zwischenreleases nach fünf PRs erstellt.

Seit dem 7. November 2026 wird nach jeweils fünf zusammengeführten Pull Requests ein Release erstellt und geprüft. Gezählt werden auch Wartungs-PRs, aber keine reine Übernahme von development nach main und keine automatischen Versions-Commits.

Vor dem Release muss der gemeinsame Stand Typecheck, Build, Unit-Tests und die Browserprüfungen der integrierten Bereiche bestehen. development wird anschließend nach main übernommen; der vorhandene Release-Workflow vergibt die nächste Version und erzeugt die Installer.

Der Release-Workflow prüft Build und Unit-Tests vor dem Paketbau. Auf Windows wird das gebaute Programm gestartet und auf einen frühen Prozessabbruch geprüft. Nach dem Workflow werden Installer, Signaturen und latest.json auf Vollständigkeit sowie die Windows-Version durch einen lokalen Start geprüft. Ein Prozessstart ersetzt keine Funktionsprüfung mit angemeldetem Jira-Konto.

Ein fehlgeschlagener Release wird repariert, bevor die nächste Fünfergruppe veröffentlicht wird. Der Merge-Zähler und die Ergebnisse je Release werden in diesem Dokument fortgeschrieben.

## Erste Gruppe

- #57: Rollout als Vorlage duplizieren
- #35: Dropdown-Untermenüs
- #36: Hinweisaktionen ohne Überdeckung
- #28: Verständliche Not-found-Ansicht
- #26: Durchsuchbare Shortcut-Hilfe

Gemeinsamer Stand: Typecheck, Build und 391 Unit-Tests grün. Browser: 84 bestanden, drei bewusst übersprungen, ein zu früher Zwischenablagevergleich im Test fehlgeschlagen. Nach Warten auf den asynchronen Kopiervorgang sind alle acht betroffenen Browserfälle grün. Anwendungsquellen blieben dabei unverändert. Die Release-Übernahme erfolgt mit PR #58; Veröffentlichung und native Prüfung stehen noch aus.

Für veröffentlichte Releases prüft `.github/scripts/test-release.ps1 -Tag vX.Y.Z` die Version sowie die Updater-Einträge, Binärdateien und Signaturen aller sieben Plattformvarianten. Gegen v0.7.0 ist dieses Prüfskript erfolgreich gelaufen.

## Gemeinsamer Backlog-Release

PR #58 wurde vom Besitzer gemergt und v0.8.0 veröffentlicht. Der Paketbau und der Windows-Starttest waren erfolgreich; die abschließende Prüfung scheiterte am nur unter Windows gesetzten TEMP-Wert. Das Prüfskript verwendet jetzt den plattformübergreifenden temporären Ordner. Die Dateien und das Updater-Manifest von v0.8.0 bestehen damit die Prüfung aller sieben Plattformvarianten.

Alle 26 weiteren offenen PRs wurden anschließend nach development integriert: #4, #5, #19, #20, #21, #22, #23, #24, #25, #27, #30, #31, #32, #33, #34, #37, #38, #39, #40, #41, #42, #43, #44, #45, #47 und #48. Release-Übernahme: PR #59.

Build, Typecheck und 690 Unit-Tests sind grün. Die vollständige Browserprüfung wird vor dem Release ausgewertet. Veraltete Tests für global gespeicherte Tabs/Favoriten wurden an die Kontotrennung angepasst. Die Fehler-Injektion wird ausschließlich durch die QA-Konfiguration erzeugt; der veröffentlichte Build enthält sie nicht.

Die vollständigen Browserprüfungen laufen für Übernahmen nach main zusätzlich im Windows-CI-Job `browser`, mit einem Worker und Edge in beiden Darstellungen. Bei Fehlern bleiben Bericht, Screenshots und Traces als Artefakt erhalten. `vite.browser-qa.config.ts` ist ausschließlich für diesen Test-Build bestimmt; native Releases verwenden weiterhin `vite.config.ts` und enthalten keine Fehler-Injektion.

Der erste vollständige Windows-Lauf auf e0c03f4 endete mit 744 bestandenen, 13 übersprungenen und drei fehlgeschlagenen Browserfällen. Beim Anhangstest fehlte zusätzlich die Bildantwort für att-1: Die Fixture lieferte HTTP 404. Sie liefert jetzt lokale PNG-Daten für Vorschau und Thumbnail. Die Tests warten auf Bild und Dialogfokus beziehungsweise das Entfernen der Palette und prüfen danach weiterhin den erhaltenen Anhangsbereich und die Tab-Navigation. Die vier betroffenen Overlay-Fälle bestehen lokal in beiden Darstellungen. Typecheck, Produktionsbuild und alle 690 Unit-Tests wurden anschließend lokal erneut erfolgreich ausgeführt; die vollständige Browserprüfung läuft noch.

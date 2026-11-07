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

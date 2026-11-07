# Release-Rhythmus

Seit dem 7. November 2026 wird nach jeweils fünf zusammengeführten Pull Requests ein Release erstellt und geprüft. Gezählt werden auch Wartungs-PRs, aber keine reine Übernahme von development nach main und keine automatischen Versions-Commits.

Vor dem Release muss der gemeinsame Stand Typecheck, Build, Unit-Tests und die Browserprüfungen der integrierten Bereiche bestehen. development wird anschließend nach main übernommen; der vorhandene Release-Workflow vergibt die nächste Version und erzeugt die Installer.

Der Release-Workflow prüft Build und Unit-Tests vor dem Paketbau. Auf Windows wird das gebaute Programm gestartet und auf einen frühen Prozessabbruch geprüft. Nach dem Workflow werden Installer, Signaturen und latest.json auf Vollständigkeit sowie die Windows-Version durch einen lokalen Start geprüft. Ein Prozessstart ersetzt keine Funktionsprüfung mit angemeldetem Jira-Konto.

Ein fehlgeschlagener Release wird repariert, bevor die nächste Fünfergruppe veröffentlicht wird. Der Merge-Zähler und die Ergebnisse je Release werden in diesem Dokument fortgeschrieben.

## Erste Gruppe

- #57: Rollout als Vorlage duplizieren
- #35: Dropdown-Untermenüs
- Drei weitere Merges und Release-Prüfung stehen noch aus.

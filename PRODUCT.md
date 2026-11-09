# Product

## Platform

Web-Oberfläche in einer Tauri-Desktopanwendung.

## Product Purpose

betterjira führt Jira-Vorgänge und Zammad-Tickets in einem gemeinsamen Arbeitsraum zusammen. Tickets beider Systeme sollen gleichwertig geöffnet und über dieselbe Tab-Leiste gewechselt werden.

## Operating Context

Der Nutzer bearbeitet verknüpfte Jira- und Zammad-Tickets. Interne Kommentare, E-Mails und Telefonnotizen sind unterschiedliche Aktionen. Eine Antwortaktion gehört zu einer beantwortbaren Nachricht, nicht zu internen Kommentaren.

## Capabilities and Constraints

Zammad wird mit Instanzadresse und API-Token verbunden. Ohne echte Zugangsdaten wird die Integration mit API-Mocks geprüft. Profilbilder und Namen sollen Kunden, Bearbeiter und Artikelautoren erkennbar machen. Die Existenz eines Token-Menüpunkts darf nicht vorausgesetzt werden; die aktuelle Nutzerinstanz zeigt diesen nicht an.

## Brand Commitments

Der bestehende Jira-Ticketaufbau ist die vom Nutzer vorgegebene Orientierung. Weniger Karten und Rahmen, verständliche Eingaben und echte Personenbilder. Die übrige App bleibt außerhalb dieses Zammad-Umbaus erhalten.

# Design System

Alle Tokens liegen in `src/index.css` (`:root` = Light, `.dark` = Dark). Der Dark Mode folgt automatisch dem Betriebssystem (Skript in `index.html`). Nutze immer die Tokens, keine Tailwind-Rohfarben wie `amber-500`.

## Flächen (von unten nach oben)

| Ebene | Token | Einsatz |
|---|---|---|
| 0 Canvas | `bg-sidebar` | Header, Sidebar |
| 1 Inhalt | `bg-background` | Hauptbereich |
| 2 Erhöht | `bg-card` | Cards, Panels |
| 3 Overlay | `bg-popover` | Menüs, Popover, Dialoge |
| Füllung | `bg-muted`, `bg-accent` | Ruhige Flächen, Hover-Zustände |

## Schatten (Elevation)

| Utility | Einsatz |
|---|---|
| `shadow-xs` | Cards, Outline-Buttons, ruhende Controls |
| `shadow-sm` | Hover auf Cards, schwebende Sidebar |
| `shadow-md` | Popover, Dropdowns, Select |
| `shadow-lg` | Untermenüs, Tooltips, schwebende Panels |
| `shadow-xl` | Sheets, Drawer |
| `shadow-2xl` | Dialoge, Command Palette |

Overlays kombinieren Schatten immer mit `ring-1 ring-foreground/10` als Haarlinie. Im Dark Mode haben die Stufen ab `md` zusätzlich eine helle Innenkante oben.

## Text

`text-foreground` (primär) → `text-muted-foreground` (sekundär, Labels, Metadaten). Beide erfüllen WCAG AA auf allen Flächen.

## Farben

| Token | Bedeutung | Muster |
|---|---|---|
| `primary` | Marke (Blau aus dem Logo), Hauptaktion, Auswahl | `bg-primary text-primary-foreground`, aktiv: `bg-primary/12` |
| `info` | In Arbeit, Links, Hinweise | `bg-info/12 text-info` |
| `success` | Erledigt, Erfolg | `bg-success/12 text-success` |
| `warning` | Veraltet, Achtung | `bg-warning/12 text-warning` |
| `destructive` | Fehler, Löschen | `bg-destructive/10 text-destructive` |
| `chart-1` … `chart-5` | Diagramme: Blau, Türkis, Violett, Amber, Rosé | |

Getönte Badges nutzen 10 bis 15 % Deckkraft. Text in der vollen Token-Farbe bleibt so in beiden Modi lesbar (≥ 4,5:1).

## Form

Radius-Basis `--radius` = 10 px (`rounded-lg`). Kleine Controls `rounded-md`, Cards und Dialoge `rounded-xl`, große Overlays `rounded-2xl`. Schrift: Geist Variable. Animationskurven und Springs: `src/lib/ease.ts`.

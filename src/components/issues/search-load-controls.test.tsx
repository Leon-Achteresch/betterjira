import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SearchLoadState } from "@/hooks/jira/use-search-load";
const capture = vi.hoisted(() => { const buttons: ComponentProps<"button">[] = []; return { buttons }; });
vi.mock("@/components/ui/button", () => ({ Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => { capture.buttons.push(props); return <button {...props} />; } }));
const { SearchLoadControls } = await import("./search-load-controls");
const model = (): SearchLoadState => ({ pending: false, visible: true, canStart: true, isBusy: () => false, start: vi.fn(), stop: vi.fn(), loaded: 50, pages: 0, duplicates: 0, message: undefined, limits: "Maximal 2000 geladene Einträge und 40 weitere Seiten pro Lauf." });
describe("etablierte Steuerelemente fuer begrenztes Suchladen", () => {
  it("nennt Grenzen und bewusste spaetere Kopie ohne Snapshot-Versprechen", () => {
    capture.buttons.length = 0; const state = model(); const markup = renderToStaticMarkup(<SearchLoadControls state={state} />);
    expect(markup).toContain("2000"); expect(markup).toContain("40"); expect(markup).toContain("Tabellenkopie selbst auslösen"); expect(markup).toContain("Keine Momentaufnahme"); expect(state.start).not.toHaveBeenCalled();
  });
  it("sperrt Parallelstart und bietet sichtbaren Abbruch waehrend des Laufs", () => {
    capture.buttons.length = 0; const state = { ...model(), pending: true, canStart: false };
    renderToStaticMarkup(<SearchLoadControls state={state} />);
    expect(capture.buttons.find((button) => button.onClick === state.start)?.disabled).toBe(true);
    expect(capture.buttons.some((button) => button.onClick === state.stop && !button.disabled)).toBe(true);
  });
  it("zeigt Teilstand, Fehler und Duplikate ohne Kopieraktion an", () => {
    const markup = renderToStaticMarkup(<SearchLoadControls state={{ ...model(), loaded: 75, pages: 1, duplicates: 5, message: "Readfehler; bisherige Treffer bleiben verfügbar." }} />);
    expect(markup).toContain("75 eindeutige Treffer"); expect(markup).toContain("5 doppelte Treffer"); expect(markup).toContain("Readfehler");
  });
});

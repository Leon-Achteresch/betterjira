import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentLeadsState } from "@/hooks/jira/use-component-leads";
const capture = vi.hoisted(() => { const buttons: ComponentProps<"button">[] = []; return { buttons }; });
vi.mock("@/components/ui/button", () => ({ Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => { capture.buttons.push(props); return <button {...props} />; } }));
vi.mock("@/components/ui/popover", () => {
  const Group = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Popover: Group, PopoverTrigger: Group, PopoverContent: Group };
});
vi.mock("@/components/people/person-label", () => ({ PersonLabel: ({ name, subtitle }: { name: string; subtitle?: string }) => <span>{name} {subtitle}</span> }));
const { ComponentLeadHints } = await import("./component-lead-hints");
const model = (): ComponentLeadsState => ({ visible: true, open: true, setOpen: vi.fn(), disabled: false, projectLabel: "DEMO", loading: false, error: undefined, invalid: 0, refreshing: false, canRefresh: true, refresh: vi.fn(), rows: [
  { id: "1", name: "Backend", status: "visible", person: { name: "Alex Leitung", initials: "AL", subtitle: "Hinterlegte Komponentenleitung" } },
  { id: "2", name: "Frontend", status: "unavailable", message: "Keine sichtbare Leitung; nicht hinterlegt oder verborgen." },
] });
beforeEach(() => { capture.buttons.length = 0; });
describe("lesender Rollenhinweis im bestehenden Popover", () => {
  it("ordnet Kontakte mehreren Komponenten zu und trifft keine Bearbeiterentscheidung", () => {
    const state = model(); const markup = renderToStaticMarkup(<ComponentLeadHints state={state} />);
    for (const text of ["Backend", "Frontend", "Alex Leitung", "verborgen", "DEMO", "keine Festlegung des Bearbeiters", "keinen hier bestimmten Vorrang"]) expect(markup).toContain(text);
    expect(state.refresh).not.toHaveBeenCalled(); expect(capture.buttons.every((button) => button.type === "button")).toBe(true);
  });
  it("behaelt lesbare Rollen neben einem unlesbaren Eintrag bei", () => {
    const state = model(); state.rows = [...state.rows, { id: "3", name: "Privat", status: "error", message: "Nicht lesbar" }];
    const markup = renderToStaticMarkup(<ComponentLeadHints state={state} />); expect(markup).toContain("Alex Leitung"); expect(markup).toContain("Nicht lesbar");
  });
  it("erklaert ungueltige Komponentenangaben und sperrt Neupruefung ohne IDs", () => {
    const state = { ...model(), invalid: 1, rows: [], canRefresh: false };
    const markup = renderToStaticMarkup(<ComponentLeadHints state={state} />); expect(markup).toContain("keine lesbare ID"); expect(capture.buttons.find((button) => button.onClick === state.refresh)?.disabled).toBe(true);
  });
  it("erzeugt bei leerer Auswahl keine neue Aktion", () => { expect(renderToStaticMarkup(<ComponentLeadHints state={{ ...model(), visible: false }} />)).toBe(""); });
});

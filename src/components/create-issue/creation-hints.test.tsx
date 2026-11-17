import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/creation-hints.json";
import { creationHintRequest, creationHintRows, CREATION_HINT_LIMITS } from "@/lib/jira/creation-hints";
import type { CreationHintsState } from "@/hooks/jira/use-creation-hints";

const capture = vi.hoisted(() => { const buttons: ComponentProps<"button">[] = []; return { buttons }; });
vi.mock("@/components/ui/button", () => ({ Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => { capture.buttons.push(props); return <button {...props} />; } }));
vi.mock("@/components/ui/popover", () => {
  const Group = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Popover: Group, PopoverTrigger: Group, PopoverContent: Group };
});
vi.mock("@/components/issues/issue-preview", () => ({ IssuePreviewTooltip: ({ children }: { children: ReactNode }) => <>{children}</> }));
const { CreationHints } = await import("./creation-hints");
const project = { id: "101", key: "DEMO" };
const model = (): CreationHintsState => ({ open: true, setOpen: vi.fn(), phase: "done", pending: false, canStart: true, start: vi.fn(async () => {}), stop: vi.fn(), result: creationHintRows(fixture, project), request: creationHintRequest(project, "Gateway Fehler"), accountLabel: "Testkonto · Site", disabledReason: undefined, limits: CREATION_HINT_LIMITS, openIssue: vi.fn() });
beforeEach(() => { capture.buttons.length = 0; });
describe("Hinweissuche im vorhandenen Erstellformular", () => {
  it("zeigt Titelwort-/Projekt-/Kontoquelle, begrenzte Menge und bestaetigte Tickets als Hinweise", () => {
    const state = model(); const markup = renderToStaticMarkup(<CreationHints state={state} />);
    for (const text of ["DEMO-1", "Gateway meldet Fehler", "Erledigt", "Testkonto", "Zielprojekt DEMO", "Gateway*", "ODER", "maximal 10", "Weitere Suchtreffer möglich", "keine bestätigten Duplikate", "Entwurf nicht"]) expect(markup).toContain(text);
    expect(markup).not.toContain("Fremdes Anliegen"); expect(markup).toContain("ausgelassen"); expect(markup).toContain("doppelt");
    expect(capture.buttons.every((button) => button.type === "button")).toBe(true); expect(state.start).not.toHaveBeenCalled(); expect(state.openIssue).not.toHaveBeenCalled();
  });
  it("bietet beim Lesen Skeleton und Abbruch mit bestehendem Callback", () => {
    const state = { ...model(), pending: true, phase: "running" as const, result: undefined, canStart: false };
    const markup = renderToStaticMarkup(<CreationHints state={state} />); expect(markup).toContain("Suche läuft"); expect(markup).toContain("Suche abbrechen");
    expect(capture.buttons.some((button) => button.onClick === state.stop && !button.disabled)).toBe(true); expect(state.stop).not.toHaveBeenCalled();
  });
  it("trennt Abbruch und Fehler von leerem Ergebnis; kein falscher Duplikatbeweis", () => {
    const cancelled = renderToStaticMarkup(<CreationHints state={{ ...model(), phase: "cancelled", result: undefined }} />);
    expect(cancelled).toContain("Suche abgebrochen");
    const failed = renderToStaticMarkup(<CreationHints state={{ ...model(), phase: "error", result: undefined }} />); expect(failed).toContain("Berechtigung"); expect(failed).toContain("Entwurf bleibt erhalten");
    const empty = renderToStaticMarkup(<CreationHints state={{ ...model(), result: creationHintRows({ issues: [], isLast: true }, project) }} />);
    expect(empty).toContain("Keine prüfbaren Hinweise"); expect(empty).toContain("beweist nicht"); expect(empty).toContain("Ende dieser Suchabfrage");
  });
  it("erklaert unbekannte Abdeckung und gesperrten Start", () => {
    const markup = renderToStaticMarkup(<CreationHints state={{ ...model(), canStart: false, disabledReason: "Ziel unbestätigt", result: creationHintRows({ issues: [] }, project) }} />);
    expect(markup).toContain("keine bestätigte Angabe zum Suchende"); expect(markup).toContain("Ziel unbestätigt"); expect(capture.buttons[0].disabled).toBe(true);
  });
});

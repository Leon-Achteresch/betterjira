import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/label-comparison.json";
import { collectComparisonLabels, compareLabelVariants, LABEL_COMPARISON_LIMITS } from "@/lib/jira/label-comparison";
import type { LabelComparisonState } from "@/hooks/use-label-comparison";

vi.mock("@/components/ui/combobox", () => {
  const Group = ({ children }: { children?: ReactNode }) => <div>{typeof children === "function" ? null : children}</div>;
  return { Combobox: Group, ComboboxContent: Group, ComboboxEmpty: Group, ComboboxInput: () => <input aria-label="Ausgangslabel" />, ComboboxItem: Group, ComboboxList: () => null };
});
const { LabelComparisonContent } = await import("./label-comparison-content");
const model = (reference = "frontend"): LabelComparisonState => {
  const inventory = collectComparisonLabels(fixture.issues);
  return { open: true, disabled: false, setOpen: vi.fn(), reference, setReference: vi.fn(), sourceLabel: "geladene Treffer der aktuellen Suche", accountLabel: "Testkonto · Site", hasMore: true, readError: false, inventory, labels: inventory.labels.map((entry) => entry.label), comparison: compareLabelVariants(inventory.labels, reference), limits: LABEL_COMPARISON_LIMITS };
};
describe("lesender Labelvergleich mit ehrlicher Quelle", () => {
  it("zeigt getrennte Originale, Gruende, lokale Haeufigkeiten und Beispiele ohne Aenderungsaktion", () => {
    const state = model(); const markup = renderToStaticMarkup(<LabelComparisonContent state={state} />);
    for (const text of ["frontend", "FrontEnd", "frontent", "Ein Zeichen Unterschied", "DEMO-1", "geprüften Tickets", "Testkonto", "nichts umbenannt", "Bedeutung", "Kein vollständiger Jira-Projektbestand"]) expect(markup).toContain(text);
    expect(markup).not.toContain("<button"); expect(state.setReference).not.toHaveBeenCalled();
  });
  it("kennzeichnet fehlende/ungueltige Felder, Readfehler und nicht geladene Treffer", () => {
    const state = { ...model(), readError: true }; const markup = renderToStaticMarkup(<LabelComparisonContent state={state} />);
    for (const text of ["Lesefehler", "bereits geladene Stand", "noch nicht geladen", "fehlend bedeutet nicht leer", "ungültige Labelangaben"]) expect(markup).toContain(text);
  });
  it("weist die exakte Auswahlquelle und Grenzen samt unvollstaendigen Haeufigkeiten aus", () => {
    const state = { ...model(), sourceLabel: "ausgewählte geladene Tickets", inventory: { ...model().inventory, limitedIssues: 9, omitted: 11 } };
    const markup = renderToStaticMarkup(<LabelComparisonContent state={state} />);
    for (const text of ["ausgewählte geladene Tickets", "Vergleich begrenzt", "1000", "500", "11", "Häufigkeiten können unvollständig sein"]) expect(markup).toContain(text);
  });
  it("erklaert fehlende Aehnlichkeit ohne Eindeutigkeit oder Bereinigung zu behaupten", () => {
    const markup = renderToStaticMarkup(<LabelComparisonContent state={model("different")} />);
    expect(markup).toContain("keine ähnliche Schreibweise gefunden"); expect(markup).toContain("belegt keine eindeutige Bedeutung");
  });
});

import type { ComponentProps, ReactNode } from "react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachmentSelectionModel } from "@/hooks/use-attachment-selection";
import fixture from "../../../tests/jira/fixtures/attachment-selection.json";

const capture = vi.hoisted(() => {
  const buttons: ComponentProps<"button">[] = [];
  return { buttons };
});
vi.mock("@/components/ui/button", () => ({ Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => {
  capture.buttons.push(props);
  return <button {...props} />;
} }));
vi.mock("@/components/motion/tooltip", () => ({ Tooltip: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Group = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Action = ({ variant: _variant, ...props }: ComponentProps<"button"> & { variant?: string }) => { capture.buttons.push(props); return <button {...props} />; };
  return { AlertDialog: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <>{children}</> : null,
    AlertDialogContent: Group, AlertDialogHeader: Group, AlertDialogTitle: Group, AlertDialogDescription: Group, AlertDialogFooter: Group, AlertDialogCancel: Action, AlertDialogAction: Action };
});
const { AttachmentDeleteDialog, AttachmentDeletionResults, AttachmentSelectionBar } = await import("./attachment-deletion-controls");

const model = (pending = false): AttachmentSelectionModel => ({
  selecting: true, selectedIds: new Set(["11", "12"]), selectedCount: 2, eligibleIds: new Set(["11", "12"]), pending,
  triggerRef: createRef<HTMLButtonElement>(), unavailableReason: undefined, error: undefined, results: [],
  setSelecting: vi.fn(), toggle: vi.fn(), selectVisible: vi.fn(), request: vi.fn(), refresh: vi.fn(),
  dialog: { open: true, issueKey: "DEMO-1", accountLabel: "Testkonto · Test-Site", attachments: fixture.attachments.slice(0, 2).map((file) => ({ ...file, name: file.filename, sizeLabel: `${file.size} B` })), pending,
    onOpenChange: vi.fn(), onConfirm: vi.fn(), onStop: vi.fn(), onCloseAutoFocus: vi.fn() },
});
beforeEach(() => { capture.buttons.length = 0; });

describe("Sichtauswahl, irreversible Bestaetigung und Dateiergebnisse", () => {
  it("nennt Konto, Ticket, exakte IDs trotz gleicher Namen und Unumkehrbarkeit ohne Undo-Versprechen", () => {
    const selection = model();
    const markup = renderToStaticMarkup(<AttachmentDeleteDialog dialog={selection.dialog} />);
    expect(markup).toContain("DEMO-1");
    expect(markup).toContain("Testkonto");
    expect(markup).toContain("ID 11");
    expect(markup).toContain("ID 12");
    expect(markup).not.toContain("ID 13");
    expect(markup).toContain("nicht rückgängig machen");
    expect(markup).toContain("Endgültig löschen");
    expect(selection.dialog.onConfirm).not.toHaveBeenCalled();
  });

  it("oeffnet ueber den Auswahlknopf nur die bestehende Bestaetigung und bestaetigt nicht selbst", () => {
    const selection = model();
    renderToStaticMarkup(<AttachmentSelectionBar selection={selection} />);
    expect(capture.buttons.some((button) => button.onClick === selection.request)).toBe(true);
    selection.request();
    expect(selection.dialog.onConfirm).not.toHaveBeenCalled();
  });

  it("sperrt Bestaetigung und Abbrechen waehrend des Laufs, bietet aber Stoppen weiterer Writes", () => {
    const selection = model(true);
    const markup = renderToStaticMarkup(<AttachmentDeleteDialog dialog={selection.dialog} />);
    expect(capture.buttons.filter((button) => button.disabled)).toHaveLength(2);
    expect(capture.buttons.some((button) => button.onClick === selection.dialog.onStop && !button.disabled)).toBe(true);
    expect(markup).toContain("nur noch nicht gesendete Löschungen");
  });

  it("stellt Erfolg, abgelehnte Datei und unklares Ergebnis getrennt dar", () => {
    const selection = model();
    selection.results = [
      { attachment: fixture.attachments[0], status: "deleted", message: "Bestaetigt", name: "gleich.png", label: "Gelöscht" },
      { attachment: fixture.attachments[1], status: "failed", message: "HTTP 403", name: "gleich.png", label: "Nicht gelöscht" },
      { attachment: fixture.attachments[2], status: "uncertain", message: "Erst Serverstand prüfen", name: "Bericht.pdf", label: "Ergebnis unklar" },
    ];
    const markup = renderToStaticMarkup(<AttachmentDeletionResults selection={selection} />);
    expect(markup).toContain("Gelöscht");
    expect(markup).toContain("Nicht gelöscht");
    expect(markup).toContain("Ergebnis unklar");
    expect(markup).toContain("HTTP 403");
    expect(markup).toContain("erneut bestätigen");
  });
});

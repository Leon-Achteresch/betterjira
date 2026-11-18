import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkEditState } from "@/hooks/jira/use-bulk-edit";
import type { DueDateShiftState } from "@/hooks/jira/use-due-date-shift";

const capture = vi.hoisted(() => { const buttons: ComponentProps<"button">[] = []; return { buttons }; });
vi.mock("@/components/ui/button", () => ({ Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => { capture.buttons.push(props); return <button {...props} />; } }));
vi.mock("@/components/motion/fade", () => ({ Fade: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/jira-field-input", () => ({ UserPicker: () => null }));
vi.mock("@/components/ui/popover", () => {
  const Group = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Popover: Group, PopoverTrigger: Group, PopoverContent: Group };
});
vi.mock("@/components/ui/select", () => {
  const Group = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Select: Group, SelectTrigger: Group, SelectValue: Group, SelectContent: Group, SelectItem: Group };
});
const { DueDateShiftPanel } = await import("./due-date-shift-panel");
const { BulkEditMenu } = await import("./bulk-edit-menu");

const shift = (): DueDateShiftState => ({
  input: "2", setInput: vi.fn(), inputError: undefined, accountLabel: "Testkonto · Test-Site", pending: false, checking: false, writing: false, waitingPrevious: false,
  isBusy: () => false, canPreview: true, requestPreview: vi.fn(), canConfirm: true, confirm: vi.fn(), stop: vi.fn(), results: [], error: null,
  preview: { days: "+2", readyCount: 1, rows: [
    { key: "DEMO-1", before: "2026-03-28", after: "2026-03-30", beforeLabel: "2026-03-28", afterLabel: "2026-03-30" },
    { key: "DEMO-2", before: null, after: null, beforeLabel: "Ohne Fälligkeit", afterLabel: "–", reason: "Keine vorhandene Fälligkeit." },
  ] },
});
const bulk = (dueShift: DueDateShiftState): BulkEditState => ({
  open: true, setOpen: vi.fn(), dueShift, tablePreview: null, transitionComment: null, operation: "shift-due-date", setOperation: vi.fn(), priority: "", setPriority: vi.fn(), status: "", setStatus: vi.fn(), labelsText: "", setLabelsText: vi.fn(),
  options: { assign: false, unassign: false, priorities: [], statuses: [], addLabels: false, removeLabels: false }, assignee: null, setAssignee: vi.fn(), userScope: { issueKey: "DEMO-1", assignee: true },
  errors: [], succeeded: 0, total: 0, failed: 0, pending: false, loading: false, error: null, canSubmit: false, submit: vi.fn(), retry: vi.fn(), reload: vi.fn(),
});
beforeEach(() => { capture.buttons.length = 0; });

describe("bestehender Bulk-Editor mit bewusstem Fälligkeitsversatz", () => {
  it("zeigt gewaehlte Keys, Konto, alte/neue Werte und ausgelassene Tickets vor der Bestaetigung", () => {
    const state = shift();
    const markup = renderToStaticMarkup(<DueDateShiftPanel state={state} />);
    for (const text of ["Testkonto", "DEMO-1", "DEMO-2", "2026-03-28", "2026-03-30", "Ohne Fälligkeit", "Wird ausgelassen", "+2", "kein automatisches Rückgängigmachen"]) expect(markup).toContain(text);
    expect(capture.buttons.some((button) => button.onClick === state.confirm && !button.disabled)).toBe(true);
    expect(state.confirm).not.toHaveBeenCalled();
  });
  it("bleibt trotz anderer fehlerhafter Bulk-Metadaten erreichbar und verwendet nur den eigenen Bestaetigungspfad", () => {
    const state = bulk(shift());
    state.error = new Error("unrelated bulk metadata failed");
    const markup = renderToStaticMarkup(<BulkEditMenu state={state} disabled={false} />);
    expect(markup).toContain("Versatz in Kalendertagen");
    expect(markup).not.toContain("Bearbeitbare Felder konnten nicht geladen");
    expect(capture.buttons.some((button) => button.onClick === state.submit || button.onClick === state.retry)).toBe(false);
    expect(state.dueShift.confirm).not.toHaveBeenCalled();
  });
  it("bietet bei nur ausgelassenen Tickets keine aktivierbare Bestaetigung", () => {
    const state = shift();
    state.canConfirm = false;
    if (state.preview) { state.preview.readyCount = 0; state.preview.rows = state.preview.rows.slice(1); }
    renderToStaticMarkup(<DueDateShiftPanel state={state} />);
    expect(capture.buttons.find((button) => button.onClick === state.confirm)?.disabled).toBe(true);
  });
  it("zeigt Teilergebnisse einschliesslich unklarem Ausgang und erfindet kein Undo oder Retry", () => {
    const state = shift();
    state.preview = null;
    state.results = [
      { row: { key: "DEMO-1", before: "2026-03-28", after: "2026-03-30" }, beforeLabel: "2026-03-28", afterLabel: "2026-03-30", status: "changed", label: "Geändert", message: "Bestaetigt" },
      { row: { key: "DEMO-2", before: "2026-10-24", after: "2026-10-26" }, beforeLabel: "2026-10-24", afterLabel: "2026-10-26", status: "uncertain", label: "Ergebnis unklar", message: "Serverstand neu prüfen" },
    ];
    const markup = renderToStaticMarkup(<DueDateShiftPanel state={state} />);
    expect(markup).toContain("Ergebnis unklar");
    expect(markup).toContain("Geändert");
    expect(markup).toContain("Kein automatischer Wiederholungsversuch");
    expect(capture.buttons.some((button) => button.onClick === state.confirm)).toBe(false);
  });
});

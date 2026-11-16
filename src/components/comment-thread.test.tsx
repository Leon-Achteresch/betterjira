import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commentActions } from "@/lib/jira/comment-permissions";
import { commentEditAction } from "@/lib/jira/comment-edit";
import type { IssueComment } from "@/lib/jira/comment-thread";
import type { CommentEntryView } from "./comment-thread";

const capture = vi.hoisted(() => {
  const buttons: ComponentProps<"button">[] = [];
  const tooltips: ReactNode[] = [];
  return { buttons, tooltips };
});
vi.mock("@/components/ui/button", () => ({
  Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => {
    capture.buttons.push(props);
    return <button {...props} />;
  },
}));
vi.mock("@/components/motion/tooltip", () => ({ Tooltip: ({ children, content }: { children: ReactNode; content?: ReactNode }) => {
  capture.tooltips.push(content);
  return <>{children}</>;
} }));
vi.mock("@/components/adf-content", () => ({ AdfContent: () => <p>Kommentarinhalt</p> }));
vi.mock("@/components/jira-user-avatar", () => ({ JiraUserLabel: () => <span>Autor</span> }));
const { CommentThreadView } = await import("./comment-thread");

const root: IssueComment = { id: "10", created: "2026-11-01T10:00:00Z", body: { type: "doc", version: 1, content: [] } };
const reply: IssueComment = { ...root, id: "11", parentId: root.id };
const onEdit = vi.fn<(comment: IssueComment) => void>();
const action = (comment = root, disabledReason?: string) => commentEditAction(comment, {
  confirmed: true, canEdit: true, label: "Bearbeiten", disabledReason, onEdit,
});
const render = (viewFor: (comment: IssueComment) => CommentEntryView, replies: IssueComment[] = []) =>
  renderToStaticMarkup(<CommentThreadView thread={{ root, replies }} viewFor={viewFor} />);

beforeEach(() => {
  capture.buttons.length = 0;
  capture.tooltips.length = 0;
  onEdit.mockReset();
});

describe("Bearbeiten am Kommentarende", () => {
  it("zeigt nach dem Inhalt denselben Callback wie der bereitgestellte Menüdeskriptor", () => {
    const edit = action()!;
    const html = render(() => ({ menu: <span>Kopfmenü</span>, editor: null, edit }));
    expect(html.indexOf("Kommentarinhalt")).toBeLessThan(html.indexOf("Bearbeiten"));
    expect(capture.buttons).toHaveLength(1);
    expect(capture.buttons[0].onClick).toBe(edit.onSelect);
    expect(capture.buttons[0].disabled).toBe(false);
    expect(capture.buttons[0].type).toBe("button");
    edit.onSelect();
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(root);
  });

  it.each([
    { confirmed: false, permissions: { editOwn: true, editAll: true, deleteOwn: false, deleteAll: false }, project: "software" },
    { confirmed: true, permissions: undefined, project: "software" },
    { confirmed: true, permissions: { editOwn: false, editAll: false, deleteOwn: false, deleteAll: false }, project: "software" },
    { confirmed: true, permissions: { editOwn: true, editAll: true, deleteOwn: false, deleteAll: false }, project: "service_desk" },
  ])("zeigt ohne bestätigte Bearbeitungserlaubnis keine Endaktion: %j", ({ confirmed, permissions, project }) => {
    const allowed = commentActions(permissions, "me", "me", project);
    const edit = commentEditAction(root, { confirmed, canEdit: allowed.canEdit, label: "Bearbeiten", onEdit });
    render(() => ({ menu: null, editor: null, edit }));
    expect(capture.buttons).toHaveLength(0);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("bindet Root- und Antwortaktionen jeweils an ihren eigenen vorhandenen Callback", () => {
    const actions = new Map([root, reply].map((comment) => [comment.id, action(comment)!]));
    render((comment) => ({ menu: null, editor: null, edit: actions.get(comment.id) }), [reply]);
    expect(capture.buttons.map((button) => button.onClick)).toEqual([actions.get(root.id)?.onSelect, actions.get(reply.id)?.onSelect]);
    actions.get(reply.id)?.onSelect();
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(reply);
  });

  it("deaktiviert einen gesperrten Kommentar wie im Menü und hält den Grund fokussierbar", () => {
    const reason = "Enthält Inhalte, die sich nur in Jira bearbeiten lassen";
    const html = render(() => ({ menu: null, editor: null, edit: action(root, reason) }));
    expect(capture.buttons[0].disabled).toBe(true);
    expect(capture.tooltips).toContain(reason);
    expect(html).toContain('tabindex="0"');
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("zeigt während der bestehenden Bearbeitung nur den Editor samt Fehler und keine zweite Endaktion", () => {
    const html = render(() => ({ menu: null, editor: <div><p role="alert">Speichern fehlgeschlagen</p><textarea defaultValue="Entwurf" /></div>, edit: action() }));
    expect(capture.buttons).toHaveLength(0);
    expect(html).toContain("Speichern fehlgeschlagen");
    expect(html).toContain("Entwurf");
    expect(html).not.toContain("Kommentarinhalt");
  });

  it("belässt Antworten neben Bearbeiten beim ursprünglichen Zielkommentar", () => {
    const onReply = vi.fn();
    const edit = action()!;
    renderToStaticMarkup(<CommentThreadView thread={{ root, replies: [] }} viewFor={() => ({ menu: null, editor: null, edit })} replyLabel="Antworten" onReply={onReply} />);
    expect(capture.buttons).toHaveLength(2);
    expect(capture.buttons[0].onClick).toBe(edit.onSelect);
    expect(capture.buttons[1].children).toContain("Antworten");
    expect(onEdit).not.toHaveBeenCalled();
    expect(onReply).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  COMMENT_PERMISSION_KEYS,
  MyPermissions,
  commentActions,
  toCommentPermissions,
  usablePermissions,
  type CommentPermissions,
} from "./comment-permissions";

const none: CommentPermissions = { editOwn: false, editAll: false, deleteOwn: false, deleteAll: false };
const own: CommentPermissions = { ...none, editOwn: true, deleteOwn: true };
const all: CommentPermissions = { editOwn: true, editAll: true, deleteOwn: true, deleteAll: true };

describe("Kommentarrechte", () => {
  it("fragt genau die vier Kommentarrechte ab", () => {
    expect(COMMENT_PERMISSION_KEYS.join(",")).toBe("EDIT_OWN_COMMENTS,EDIT_ALL_COMMENTS,DELETE_OWN_COMMENTS,DELETE_ALL_COMMENTS");
  });

  it("liest havePermission aus der Antwort von mypermissions", () => {
    const decoded = Schema.decodeUnknownSync(MyPermissions)({
      permissions: {
        EDIT_OWN_COMMENTS: { id: "1", key: "EDIT_OWN_COMMENTS", havePermission: true },
        EDIT_ALL_COMMENTS: { id: "2", key: "EDIT_ALL_COMMENTS", havePermission: false },
        DELETE_OWN_COMMENTS: { id: "3", key: "DELETE_OWN_COMMENTS", havePermission: true },
      },
    });
    expect(toCommentPermissions(decoded)).toEqual({ editOwn: true, editAll: false, deleteOwn: true, deleteAll: false });
  });

  it("erlaubt eigene Kommentare mit OWN-Rechten, fremde nur mit ALL-Rechten", () => {
    expect(commentActions(own, "me", "me", "software")).toEqual({ canEdit: true, canDelete: true });
    expect(commentActions(own, "lea", "me", "software")).toEqual({ canEdit: false, canDelete: false });
    expect(commentActions(all, "lea", "me", "software")).toEqual({ canEdit: true, canDelete: true });
    expect(commentActions(none, "me", "me", "software")).toEqual({ canEdit: false, canDelete: false });
  });

  it("behandelt Kommentare ohne Autor-ID nie als eigene", () => {
    expect(commentActions(own, undefined, undefined, "software")).toEqual({ canEdit: false, canDelete: false });
    expect(commentActions(own, undefined, "me", "software")).toEqual({ canEdit: false, canDelete: false });
  });

  it("bietet nichts an, solange die Rechte fehlen", () => {
    expect(commentActions(undefined, "me", "me", "software")).toEqual({ canEdit: false, canDelete: false });
  });

  it("bietet in Service-Desk-Projekten kein Bearbeiten, aber Löschen", () => {
    expect(commentActions(all, "me", "me", "service_desk")).toEqual({ canEdit: false, canDelete: true });
  });

  it("verwirft alte Rechte, sobald ihr Abruf gescheitert ist", () => {
    expect(usablePermissions(all, true)).toBeUndefined();
    expect(usablePermissions(all, false)).toEqual(all);
    expect(usablePermissions(undefined, false)).toBeUndefined();
    expect(commentActions(usablePermissions(all, true), "me", "me", "software")).toEqual({ canEdit: false, canDelete: false });
  });
});

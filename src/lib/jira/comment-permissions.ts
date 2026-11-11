import { Schema } from "effect";

export const COMMENT_PERMISSION_KEYS = ["EDIT_OWN_COMMENTS", "EDIT_ALL_COMMENTS", "DELETE_OWN_COMMENTS", "DELETE_ALL_COMMENTS"] as const;

export const MyPermissions = Schema.Struct({
  permissions: Schema.Record(Schema.String, Schema.Struct({ havePermission: Schema.Boolean })),
});

export type CommentPermissions = { editOwn: boolean; editAll: boolean; deleteOwn: boolean; deleteAll: boolean };

const granted = (permissions: (typeof MyPermissions.Type)["permissions"], key: (typeof COMMENT_PERMISSION_KEYS)[number]) =>
  permissions[key]?.havePermission === true;

export const toCommentPermissions = ({ permissions }: typeof MyPermissions.Type): CommentPermissions => ({
  editOwn: granted(permissions, "EDIT_OWN_COMMENTS"),
  editAll: granted(permissions, "EDIT_ALL_COMMENTS"),
  deleteOwn: granted(permissions, "DELETE_OWN_COMMENTS"),
  deleteAll: granted(permissions, "DELETE_ALL_COMMENTS"),
});

export const usablePermissions = (data: CommentPermissions | undefined, failed: boolean) => (failed ? undefined : data);

export type CommentActions = { canEdit: boolean; canDelete: boolean };

export const commentActions = (
  permissions: CommentPermissions | undefined,
  authorAccountId: string | undefined,
  myAccountId: string | undefined,
  projectTypeKey: string | undefined,
): CommentActions => {
  if (!permissions) return { canEdit: false, canDelete: false };
  const own = !!myAccountId && authorAccountId === myAccountId;
  return {
    canEdit: projectTypeKey !== "service_desk" && (permissions.editAll || (own && permissions.editOwn)),
    canDelete: permissions.deleteAll || (own && permissions.deleteOwn),
  };
};

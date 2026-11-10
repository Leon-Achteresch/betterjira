import { invoke } from "@tauri-apps/api/core";
import { Effect, Schema } from "effect";
import { ZammadError } from "./client";
import type { Upload } from "./model";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const encodeUploads = (files: readonly File[]) =>
  Effect.tryPromise({
    try: async () => {
      if (files.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_BYTES)
        throw new Error("Anhänge dürfen zusammen höchstens 20 MB groß sein.");
      return Promise.all(
        files.map(async (file): Promise<Upload> => {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          return {
            filename: file.name,
            data: btoa(binary),
            "mime-type": file.type || "application/octet-stream",
          };
        }),
      );
    },
    catch: (cause) =>
      new ZammadError({
        message:
          cause instanceof Error
            ? cause.message
            : "Anhänge konnten nicht gelesen werden",
        cause,
      }),
  });
const Download = Schema.Struct({
  status: Schema.Number,
  data: Schema.NullOr(Schema.Array(Schema.Number)),
});
export const downloadAttachment = (
  ticketId: number,
  articleId: number,
  attachmentId: string | number,
  filename: string,
) =>
  Effect.tryPromise({
    try: () =>
      invoke<unknown>("zammad_request", {
        path: `/ticket_attachment/${ticketId}/${articleId}/${encodeURIComponent(attachmentId)}`,
        method: "GET",
        body: null,
        binary: true,
      }),
    catch: (cause) =>
      new ZammadError({
        message: "Anhang konnte nicht heruntergeladen werden",
        cause,
      }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Download)),
    Effect.flatMap((response) => {
      if (response.status !== 200 || !response.data)
        return Effect.fail(
          new ZammadError({
            message: "Anhang nicht verfügbar oder keine Berechtigung",
            status: response.status,
          }),
        );
      return Effect.sync(() => {
        const url = URL.createObjectURL(
          new Blob([Uint8Array.from(response.data ?? [])], {
            type: "application/octet-stream",
          }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename.replace(/[/\\]/g, "_");
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      });
    }),
  );

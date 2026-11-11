import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, Selection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { adfNodeToEditor, withTrailingParagraph, type AdfNode } from "./adf";

export type EditorFileHandler = {
  accepts: (file: File) => boolean;
  add: (file: File) => Promise<AdfNode | null>;
};

type PlaceholderAction = { add: { id: object; pos: number; element: HTMLElement } } | { remove: object };

const placeholders = new PluginKey<DecorationSet>("adfUploadPlaceholder");

export const AdfUploadPlaceholder = Extension.create({
  name: "adfUploadPlaceholder",
  addProseMirrorPlugins: () => [
    new Plugin<DecorationSet>({
      key: placeholders,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, current) => {
          const mapped = current.map(tr.mapping, tr.doc);
          const action = tr.getMeta(placeholders) as PlaceholderAction | undefined;
          if (!action) return mapped;
          if ("add" in action) return mapped.add(tr.doc, [Decoration.widget(action.add.pos, action.add.element, { id: action.add.id, side: -1 })]);
          return mapped.remove(mapped.find(undefined, undefined, (spec) => spec.id === action.remove));
        },
      },
      props: { decorations: (state) => placeholders.getState(state) },
    }),
  ],
});

export const uploadPlaceholderPos = (state: EditorState, id: object) =>
  placeholders.getState(state)?.find(undefined, undefined, (spec) => spec.id === id)[0]?.from;

const placeholderElement = (name: string, preview: string | undefined) => {
  const element = document.createElement("span");
  element.dataset.adfUpload = "pending";
  element.contentEditable = "false";
  element.setAttribute("role", "status");
  element.setAttribute("aria-label", `${name} wird hochgeladen`);
  element.className = "my-1 block w-fit max-w-full animate-pulse overflow-hidden rounded-xl bg-muted motion-reduce:animate-none";
  if (preview) {
    const image = document.createElement("img");
    image.src = preview;
    image.alt = "";
    image.className = "block max-h-64 max-w-full opacity-60";
    element.append(image);
  } else {
    element.classList.add("px-2.5", "py-1.5", "text-xs", "text-muted-foreground");
    element.textContent = `${name} wird hochgeladen …`;
  }
  return element;
};

export const startUploadPlaceholder = (view: EditorView, pos: number, name: string, preview: string | undefined) => {
  const id = {};
  view.dispatch(view.state.tr.setMeta(placeholders, { add: { id, pos, element: placeholderElement(name, preview) } }).setMeta("addToHistory", false));
  return id;
};

export const finishUploadPlaceholder = (view: EditorView, id: object, node: AdfNode | null) => {
  if (view.isDestroyed) return;
  const { state } = view;
  const at = uploadPlaceholderPos(state, id);
  const tr = state.tr.setMeta(placeholders, { remove: id });
  if (node && at !== undefined) {
    const follow = state.selection.empty && state.selection.from === at;
    const inserted = state.schema.nodeFromJSON(adfNodeToEditor(node));
    tr.replaceRangeWith(at, at, inserted);
    let end = at;
    tr.steps.at(-1)?.getMap().forEach((_oldStart, _oldEnd, _newStart, newEnd) => {
      end = newEnd;
    });
    if (inserted.isInline) {
      tr.insert(end, state.schema.text(" "));
      end += 1;
    }
    withTrailingParagraph(tr);
    if (follow) tr.setSelection(Selection.near(tr.doc.resolve(end), 1)).scrollIntoView();
  }
  view.dispatch(tr);
};

export const insertUpload = async (view: EditorView, pos: number, file: File, add: EditorFileHandler["add"]) => {
  const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
  const id = startUploadPlaceholder(view, pos, file.name, preview);
  try {
    finishUploadPlaceholder(view, id, await add(file));
  } catch (error) {
    finishUploadPlaceholder(view, id, null);
    throw error;
  } finally {
    if (preview) URL.revokeObjectURL(preview);
  }
};

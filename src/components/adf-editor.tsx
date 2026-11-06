import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type ReactNodeViewProps } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { BoldIcon, CodeIcon, ItalicIcon, ListIcon, ListOrderedIcon, type LucideIcon } from "lucide-react";
import { AdfContent, AdfNodeView } from "@/components/adf-content";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/ease";
import { AdfBlock, AdfInline, AdfMarks, AdfMention, AdfStarterKit, adfToEditor, editorToAdf, isAdfDoc, isEditableAdf, type AdfNode } from "@/lib/jira/adf";
import { cn } from "@/lib/utils";

function PreservedNode({ node }: ReactNodeViewProps) {
  const inline = node.type.name === "adfInline";
  return (
    <NodeViewWrapper
      as={inline ? "span" : "div"}
      title="Wird unverändert übernommen"
      className={cn("rounded-sm ring-1 ring-border/60 data-[selected]:ring-ring", inline ? "inline" : "my-1 block p-1")}
    >
      <AdfNodeView node={JSON.parse(String(node.attrs.json))} />
    </NodeViewWrapper>
  );
}

export type MentionSuggestion = Omit<SuggestionOptions, "editor">;

export type AdfEditorHandle = { focus: () => void };

export type AdfEditorProps = {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: AdfNode) => void;
  disabled?: boolean;
  toolbar?: boolean;
  autoFocus?: boolean;
  suggestion?: MentionSuggestion;
  isSuggestionOpen?: () => boolean;
  onSubmitShortcut?: () => void;
  onEscape?: () => void;
  aria?: Readonly<Record<string, string | undefined>>;
  ref?: Ref<AdfEditorHandle>;
};

const preservedExtensions = [
  AdfStarterKit,
  AdfInline.extend({ addNodeView: () => ReactNodeViewRenderer(PreservedNode, { as: "span" }) }),
  AdfBlock.extend({ addNodeView: () => ReactNodeViewRenderer(PreservedNode) }),
  AdfMarks,
];

const buildExtensions = (suggestion?: MentionSuggestion) => [
  ...preservedExtensions,
  suggestion ? AdfMention.configure({ suggestion }) : AdfMention,
];

const tools: { label: string; icon: LucideIcon; name: string; run: (editor: Editor) => void }[] = [
  { label: "Fett", icon: BoldIcon, name: "bold", run: (editor) => editor.chain().focus().toggleBold().run() },
  { label: "Kursiv", icon: ItalicIcon, name: "italic", run: (editor) => editor.chain().focus().toggleItalic().run() },
  { label: "Code", icon: CodeIcon, name: "code", run: (editor) => editor.chain().focus().toggleCode().run() },
  { label: "Aufzählung", icon: ListIcon, name: "bulletList", run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: "Nummerierung", icon: ListOrderedIcon, name: "orderedList", run: (editor) => editor.chain().focus().toggleOrderedList().run() },
];

const EDITOR_CLASS =
  "min-h-24 max-h-80 overflow-y-auto px-2.5 py-2 text-sm leading-relaxed outline-none [&_a]:text-info [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_hr]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-6 [&>*+*]:mt-2 [&_[data-type=mention]]:rounded [&_[data-type=mention]]:bg-muted [&_[data-type=mention]]:px-1 [&_[data-type=mention]]:font-medium";

const serialize = (value: unknown) => (isAdfDoc(value) ? JSON.stringify(value) : null);

const isSubmitShortcut = (event: KeyboardEvent) => event.key === "Enter" && (event.metaKey || event.ctrlKey);

export function AdfEditor({
  id,
  label,
  value,
  onChange,
  disabled = false,
  toolbar = true,
  autoFocus = false,
  suggestion,
  isSuggestionOpen,
  onSubmitShortcut,
  onEscape,
  aria,
  ref,
}: AdfEditorProps) {
  const reduce = useReducedMotion();
  const [{ initial, editable, extensions }] = useState(() => {
    const initial = isAdfDoc(value) ? value : undefined;
    return { initial, editable: !initial || isEditableAdf(initial), extensions: buildExtensions(suggestion) };
  });
  const emitted = useRef(serialize(value));
  const handlers = useRef({ onChange, isSuggestionOpen, onSubmitShortcut, onEscape });
  useLayoutEffect(() => {
    handlers.current = { onChange, isSuggestionOpen, onSubmitShortcut, onEscape };
  });
  const editor = useEditor({
    extensions,
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    content: initial && editable ? adfToEditor(initial) : undefined,
    onUpdate: ({ editor }) => {
      const doc = editorToAdf(editor.getJSON());
      emitted.current = JSON.stringify(doc);
      handlers.current.onChange(doc);
    },
    editorProps: {
      attributes: { id, role: "textbox", "aria-multiline": "true", "aria-label": label, class: EDITOR_CLASS },
      handleKeyDown: (_view, event) => {
        if (event.isComposing || handlers.current.isSuggestionOpen?.()) return false;
        const submit = handlers.current.onSubmitShortcut;
        const escape = handlers.current.onEscape;
        if (submit && isSubmitShortcut(event)) {
          submit();
          return true;
        }
        if (escape && event.key === "Escape") {
          escape();
          return true;
        }
        return false;
      },
    },
  });
  const active = useEditorState({
    editor,
    selector: ({ editor }) => Object.fromEntries(tools.map((tool) => [tool.name, editor.isActive(tool.name)])),
  });

  useImperativeHandle(ref, () => ({ focus: () => editor.commands.focus("end") }), [editor]);

  useLayoutEffect(() => {
    const incoming = serialize(value);
    if (incoming === emitted.current) return;
    emitted.current = incoming;
    if (isAdfDoc(value) && isEditableAdf(value)) editor.commands.setContent(adfToEditor(value), { emitUpdate: false });
    else if (incoming === null && !editor.isEmpty) editor.commands.clearContent(false);
  }, [editor, value]);

  useLayoutEffect(() => {
    if (editor.isEditable !== !disabled) editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  useLayoutEffect(() => {
    const dom = editor.view.dom;
    if (!aria || !(dom instanceof HTMLElement)) return;
    const names = Object.keys(aria);
    for (const name of names) {
      const attribute = aria[name];
      if (attribute === undefined) dom.removeAttribute(name);
      else dom.setAttribute(name, attribute);
    }
    return () => {
      for (const name of names) dom.removeAttribute(name);
    };
  }, [editor, aria]);

  if (!editable) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-input p-2.5">
        <AdfContent doc={initial} />
        <p className="text-xs text-muted-foreground">
          Dieser Inhalt ist so aufgebaut, dass betterjira ihn nicht ohne Verlust bearbeiten kann. Er bleibt unverändert; ändern lässt er sich in Jira.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        disabled && "opacity-60",
      )}
    >
      <AnimatePresence initial={false}>
        {toolbar && (
          <motion.div
            key="toolbar"
            role="toolbar"
            aria-label={`${label} formatieren`}
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex gap-0.5 border-b border-input p-1"
          >
            {tools.map(({ label: toolLabel, icon: Icon, name, run }) => (
              <Button
                key={name}
                type="button"
                variant={active[name] ? "secondary" : "ghost"}
                size="icon-xs"
                aria-label={toolLabel}
                aria-pressed={active[name]}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(editor)}
              >
                <Icon />
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <EditorContent editor={editor} />
    </div>
  );
}

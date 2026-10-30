import { useState } from "react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type ReactNodeViewProps } from "@tiptap/react";
import { BoldIcon, CodeIcon, ItalicIcon, ListIcon, ListOrderedIcon, type LucideIcon } from "lucide-react";
import { AdfContent, AdfNodeView } from "@/components/adf-content";
import { Button } from "@/components/ui/button";
import { AdfBlock, AdfInline, AdfMarks, AdfStarterKit, adfToEditor, editorToAdf, isAdfDoc, isEditableAdf, type AdfNode } from "@/lib/jira/adf";
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

const extensions = [
  AdfStarterKit,
  AdfInline.extend({ addNodeView: () => ReactNodeViewRenderer(PreservedNode, { as: "span" }) }),
  AdfBlock.extend({ addNodeView: () => ReactNodeViewRenderer(PreservedNode) }),
  AdfMarks,
];

const tools: { label: string; icon: LucideIcon; name: string; run: (editor: Editor) => void }[] = [
  { label: "Fett", icon: BoldIcon, name: "bold", run: (editor) => editor.chain().focus().toggleBold().run() },
  { label: "Kursiv", icon: ItalicIcon, name: "italic", run: (editor) => editor.chain().focus().toggleItalic().run() },
  { label: "Code", icon: CodeIcon, name: "code", run: (editor) => editor.chain().focus().toggleCode().run() },
  { label: "Aufzählung", icon: ListIcon, name: "bulletList", run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: "Nummerierung", icon: ListOrderedIcon, name: "orderedList", run: (editor) => editor.chain().focus().toggleOrderedList().run() },
];

export function AdfEditor({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: AdfNode) => void;
}) {
  const [{ initial, editable }] = useState(() => {
    const initial = isAdfDoc(value) ? value : undefined;
    return { initial, editable: !initial || isEditableAdf(initial) };
  });
  const editor = useEditor({
    extensions,
    content: initial && editable ? adfToEditor(initial) : undefined,
    onUpdate: ({ editor }) => onChange(editorToAdf(editor.getJSON())),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class:
          "min-h-24 max-h-80 overflow-y-auto px-2.5 py-2 text-sm leading-relaxed outline-none [&_a]:text-info [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_hr]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-6 [&>*+*]:mt-2",
      },
    },
  });
  const active = useEditorState({
    editor,
    selector: ({ editor }) => Object.fromEntries(tools.map((tool) => [tool.name, editor.isActive(tool.name)])),
  });

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
    <div className="rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <div role="toolbar" aria-label={`${label} formatieren`} className="flex gap-0.5 border-b border-input p-1">
        {tools.map(({ label: toolLabel, icon: Icon, name, run }) => (
          <Button
            key={name}
            type="button"
            variant={active[name] ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label={toolLabel}
            aria-pressed={active[name]}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(editor)}
          >
            <Icon />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

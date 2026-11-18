import { useId, useRef, useState } from "react";
import { TableIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { AdfNode } from "@/lib/jira/adf";
import { OFFICE_TSV_LIMITS, parseOfficeTsv } from "@/lib/jira/office-tsv";

export function AdfTableImport({ disabled, onInsert, focusEditor }: {
  disabled: boolean;
  onInsert: (table: AdfNode) => boolean;
  focusEditor: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const inserted = useRef(false);

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      setError("");
      if (!next) setText("");
    }}>
      <Tooltip content="Tabelle aus Zwischenablage übernehmen">
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Tabelle aus Zwischenablage übernehmen" disabled={disabled} className="size-8 rounded-xl">
            <TableIcon />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        aria-label="Tabelle übernehmen"
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] p-3"
        onCloseAutoFocus={(event) => {
          if (!inserted.current) return;
          inserted.current = false;
          event.preventDefault();
          focusEditor();
        }}
      >
        <Label htmlFor={id}>Kopierte TSV-Zellen</Label>
        <Textarea
          id={id}
          value={text}
          onChange={(event) => {
            const value = event.target.value;
            if (value.length > OFFICE_TSV_LIMITS.characters) {
              setText("");
              setError("Die Tabelle darf höchstens 32.000 Zeichen enthalten.");
              return;
            }
            setText(value);
            setError("");
          }}
          aria-describedby={`${id}-hint`}
          aria-invalid={!!error}
          rows={4}
          className="min-h-24 rounded-xl font-mono text-xs"
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Füge kopierte Zellen aus Excel oder einem anderen Tabellenprogramm ein. Bis zu 50 Zeilen, 12 Spalten und 32.000 Zeichen.
        </p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button
          type="button"
          size="sm"
          className="self-end rounded-xl"
          disabled={disabled || !text}
          onClick={() => {
            const parsed = parseOfficeTsv(text);
            if ("error" in parsed) {
              setError(parsed.error);
              return;
            }
            if (!onInsert(parsed.table)) {
              setError("Die Tabelle konnte hier nicht eingefügt werden.");
              return;
            }
            inserted.current = true;
            setText("");
            setOpen(false);
          }}
        >
          In Entwurf einfügen
        </Button>
      </PopoverContent>
    </Popover>
  );
}

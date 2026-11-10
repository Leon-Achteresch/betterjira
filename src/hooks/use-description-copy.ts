import { useMemo, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { plainDescription } from "@/lib/jira/adf-plain-text";

const UNAVAILABLE = {
  missing: "Ticket hat keine Beschreibung",
  blank: "Beschreibung enthält keinen Text",
  unreadable: "Beschreibung ist nicht als Text lesbar",
} as const;

export function useDescriptionCopy(savedDescription: unknown) {
  const description = useMemo(() => plainDescription(savedDescription), [savedDescription]);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);

  return {
    disabled: description.kind !== "text" || pending,
    hint: description.kind !== "text" ? UNAVAILABLE[description.kind] : pending ? "Wird kopiert …" : "Gespeicherter Stand",
    copy: () => {
      if (description.kind !== "text" || busy.current) return;
      busy.current = true;
      setPending(true);
      void copyToClipboard(description.text, "Beschreibung kopiert").finally(() => {
        busy.current = false;
        setPending(false);
      });
    },
  };
}

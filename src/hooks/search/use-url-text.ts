import { useState } from "react";
import { normalizeQuery } from "@/lib/search/search-params";
import { initialUrlText, syncUrlText, typeUrlText } from "@/lib/search/url-text";

export function useUrlText(url: string, write: (text: string) => void) {
  const [state, setState] = useState(() => initialUrlText(url));
  const synced = syncUrlText(state, url);
  if (synced !== state) setState(synced);

  return {
    text: synced.text,
    setText: (text: string) => {
      const written = normalizeQuery(text);
      setState(typeUrlText(synced, text, written));
      write(written);
    },
  };
}

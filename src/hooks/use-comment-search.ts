import { useRef, useState, type KeyboardEvent } from "react";

export function useCommentSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => {
    setQuery("");
    setOpen(false);
    toggleRef.current?.focus();
  };

  return {
    open,
    query,
    toggleRef,
    inputRef,
    setQuery,
    reset: () => {
      setQuery("");
      inputRef.current?.focus();
    },
    toggle: () => (open ? close() : setOpen(true)),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Escape" || query) return;
      event.stopPropagation();
      close();
    },
  };
}

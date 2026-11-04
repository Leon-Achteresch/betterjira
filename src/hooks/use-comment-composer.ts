import { useState, type FocusEvent } from "react";

export function useCommentComposer(hasContent: boolean) {
  const [focused, setFocused] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return {
    expanded: focused || templatesOpen || hasContent,
    templatesOpen,
    setTemplatesOpen,
    onFocusCapture: () => setFocused(true),
    onBlurCapture: (event: FocusEvent<HTMLFormElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    },
  };
}

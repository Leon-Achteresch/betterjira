import { useCallback, useRef } from "react";

export function useKeyedFocus() {
  const elements = useRef(new Map<string, HTMLElement>());
  const fallback = useRef<HTMLElement | null>(null);

  const refFor = useCallback(
    (key: string) => (element: HTMLElement | null) => {
      if (!element) return;
      elements.current.set(key, element);
      return () => {
        if (elements.current.get(key) === element) elements.current.delete(key);
      };
    },
    [],
  );

  const fallbackRef = useCallback((element: HTMLElement | null) => {
    fallback.current = element;
  }, []);

  const focus = useCallback((key: string | undefined) => {
    const target = (key === undefined ? undefined : elements.current.get(key)) ?? fallback.current;
    target?.focus();
  }, []);

  return { refFor, fallbackRef, focus };
}

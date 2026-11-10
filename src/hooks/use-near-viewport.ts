import { useEffect, useRef, useState } from "react";

const SCROLL_ROOT = "[data-scroll-restoration-id]";

export function useNearViewport<T extends HTMLElement>(margin: number) {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const target = ref.current;
    if (near || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { root: target.closest<HTMLElement>(SCROLL_ROOT), rootMargin: `${margin}px` },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}

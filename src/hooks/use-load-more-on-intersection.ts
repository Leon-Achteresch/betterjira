import { useEffect, useEffectEvent, useRef } from "react";

export const useLoadMoreOnIntersection = (enabled: boolean, onLoadMore: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  const load = useEffectEvent(onLoadMore);
  useEffect(() => {
    const target = ref.current;
    if (!enabled || !target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) load();
    }, { rootMargin: "300px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);
  return ref;
};

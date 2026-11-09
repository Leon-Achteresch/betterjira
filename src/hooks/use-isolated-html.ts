import { useCallback, useEffect, useRef } from "react";

export const useIsolatedHtml = () => {
  const observer = useRef<ResizeObserver | null>(null);
  const onLoad = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      observer.current?.disconnect();
      const frame = event.currentTarget;
      const body = frame.contentDocument?.body;
      if (!body) return;
      const resize = () => {
        frame.style.height = `${Math.min(800, Math.max(48, body.scrollHeight + 4))}px`;
      };
      resize();
      observer.current = new ResizeObserver(resize);
      observer.current.observe(body);
    },
    [],
  );
  useEffect(() => () => observer.current?.disconnect(), []);
  return onLoad;
};

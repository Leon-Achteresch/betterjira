import { useEffect, useRef, useState } from "react";
import { useLatestRef } from "./use-latest-ref";

export function useContextSession(context: string) {
  const [session, setSession] = useState(() => ({ context }));
  const current = session.context === context ? session : { context };
  if (current !== session) setSession(current);
  const latest = useLatestRef(current);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return { token: current, isCurrent: () => mounted.current && latest.current === current };
}

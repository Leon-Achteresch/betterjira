import { useRef } from "react";

export const useSubmissionLock = () => {
  const pending = useRef(new Set<string>());
  return {
    acquire: (key: string) => {
      if (pending.current.has(key)) return false;
      pending.current.add(key);
      return true;
    },
    release: (key: string) => {
      pending.current.delete(key);
    },
  };
};

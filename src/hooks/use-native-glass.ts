import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { enableNativeMaterial, nativeMaterialKeys } from "@/lib/native-material";

export function useNativeGlass() {
  const material = useQuery({
    queryKey: nativeMaterialKeys.enabled,
    queryFn: ({ signal }) => Effect.runPromise(enableNativeMaterial, { signal }),
    enabled: isTauri(),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const enabled = material.data === true;
  useEffect(() => {
    document.documentElement.classList.toggle("native-glass", enabled);
    return () => document.documentElement.classList.remove("native-glass");
  }, [enabled]);
}

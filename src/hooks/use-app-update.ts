import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Update } from "@tauri-apps/plugin-updater";
import { Effect } from "effect";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RELEASES_URL, appUpdateKeys, checkForUpdate, currentVersion, installUpdate } from "@/lib/app-update";
import { extractHighlights, publishedLabel } from "@/lib/release-notes";

const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

type SkippedUpdate = {
  version: string | null;
  setVersion: (version: string | null) => void;
};

const useSkippedUpdate = create<SkippedUpdate>()(
  persist((set) => ({ version: null, setVersion: (version) => set({ version }) }), {
    name: "betterjira-skipped-update",
  }),
);

export function useAppUpdate() {
  const skipped = useSkippedUpdate((state) => state.version);
  const setSkipped = useSkippedUpdate((state) => state.setVersion);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  const { data: update } = useQuery({
    queryKey: appUpdateKeys.check,
    queryFn: () => Effect.runPromise(checkForUpdate),
    enabled: !import.meta.env.DEV,
    staleTime: CHECK_INTERVAL,
    refetchInterval: CHECK_INTERVAL,
    retry: false,
  });

  const visible = update && update.version !== skipped && update.version !== dismissed ? update : null;

  const { data: installed } = useQuery({
    queryKey: appUpdateKeys.version,
    queryFn: () => Effect.runPromise(currentVersion),
    enabled: visible !== null,
    staleTime: Infinity,
  });

  const install = useMutation({
    mutationFn: (next: Update) => Effect.runPromise(installUpdate(next, setPercent)),
    onMutate: () => setPercent(0),
    onError: () => setPercent(null),
  });

  const busy = percent !== null;

  function dismiss() {
    if (busy || !visible) return;
    install.reset();
    setDismissed(visible.version);
  }

  function skip() {
    if (busy || !visible) return;
    const version = visible.version;
    install.reset();
    setSkipped(version);
    toast.success(`Version ${version} wird übersprungen`, {
      description: "Beim nächsten Update wirst du wieder benachrichtigt.",
      action: { label: "Rückgängig", onClick: () => setSkipped(null) },
    });
  }

  function openReleaseNotes() {
    void openUrl(RELEASES_URL);
  }

  return {
    update: visible
      ? {
          version: visible.version,
          currentVersion: installed ?? null,
          published: publishedLabel(visible.date),
          highlights: visible.body ? extractHighlights(visible.body) : [],
        }
      : null,
    percent,
    failed: install.isError,
    install: () => {
      if (visible) install.mutate(visible);
    },
    dismiss,
    skip,
    openReleaseNotes,
  };
}

import { useEffect, useState } from "react";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Update } from "@tauri-apps/plugin-updater";
import { Effect } from "effect";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RELEASES_URL, appUpdateKeys, checkForUpdate, currentVersion, installUpdate, restartApp } from "@/lib/app-update";
import { useUpdatePreferences } from "@/hooks/use-update-preferences";
import { extractHighlights, publishedLabel } from "@/lib/release-notes";

const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

export const updateCheckQuery = queryOptions({
  queryKey: appUpdateKeys.check,
  queryFn: () => Effect.runPromise(checkForUpdate),
  staleTime: CHECK_INTERVAL,
  retry: false,
});

export const installedVersionQuery = queryOptions({
  queryKey: appUpdateKeys.version,
  queryFn: () => Effect.runPromise(currentVersion),
  staleTime: Infinity,
});

const promptRestart = (version: string) =>
  toast.success(`Version ${version} ist installiert`, {
    description: "Sie wird beim nächsten Start von betterjira aktiv.",
    duration: Infinity,
    action: { label: "Jetzt neu starten", onClick: () => void Effect.runPromise(restartApp) },
  });

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
  const autoCheck = useUpdatePreferences((state) => state.autoCheck);
  const autoInstall = useUpdatePreferences((state) => state.autoInstall);

  const { data: update } = useQuery({
    ...updateCheckQuery,
    enabled: !import.meta.env.DEV && autoCheck,
    refetchInterval: autoCheck ? CHECK_INTERVAL : false,
  });

  const visible = update && update.version !== skipped && update.version !== dismissed ? update : null;

  const { data: installed } = useQuery({ ...installedVersionQuery, enabled: visible !== null });

  const install = useMutation({
    mutationFn: ({ update: next, restart }: { update: Update; restart: boolean }) =>
      Effect.runPromise(restart ? Effect.andThen(installUpdate(next, setPercent), restartApp) : installUpdate(next, setPercent)),
    onMutate: () => setPercent(0),
    onError: () => setPercent(null),
    onSuccess: (_, { update: next, restart }) => {
      if (restart) return;
      setPercent(null);
      setDismissed(next.version);
      promptRestart(next.version);
    },
  });

  const { mutate } = install;
  const autoInstallTarget = autoInstall && visible && install.isIdle ? visible : null;
  useEffect(() => {
    if (autoInstallTarget) mutate({ update: autoInstallTarget, restart: false });
  }, [autoInstallTarget, mutate]);

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
      if (visible) install.mutate({ update: visible, restart: true });
    },
    dismiss,
    skip,
    openReleaseNotes,
  };
}

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { installedVersionQuery, updateCheckQuery } from "@/hooks/use-app-update";
import { useUpdatePreferences } from "@/hooks/use-update-preferences";
import { appUpdateKeys, compareVersions, installVersion, listReleases, restartApp } from "@/lib/app-update";
import { publishedLabel } from "@/lib/release-notes";

export function useUpdateSettings() {
  const preferences = useUpdatePreferences();
  const [percent, setPercent] = useState<number | null>(null);

  const installed = useQuery(installedVersionQuery);
  const check = useQuery({ ...updateCheckQuery, enabled: false });
  const releases = useQuery({
    queryKey: appUpdateKeys.releases,
    queryFn: ({ signal }) => Effect.runPromise(listReleases, { signal }),
    staleTime: 10 * 60 * 1000,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const current = installed.data ?? null;
  const target = selected ?? releases.data?.find((release) => release.version !== current)?.version ?? null;
  const direction = target && current ? compareVersions(target, current) : 0;

  const install = useMutation({
    mutationFn: (version: string) => Effect.runPromise(Effect.andThen(installVersion(version, setPercent), restartApp)),
    onMutate: (version) => {
      setPercent(0);
      if (current && compareVersions(version, current) < 0 && preferences.autoInstall) {
        preferences.setAutoInstall(false);
        toast.info("Automatische Installation pausiert", {
          description: "Sonst würde die neueste Version sofort wieder installiert.",
        });
      }
    },
    onError: (error) => {
      setPercent(null);
      toast.error(error.message);
    },
  });

  async function checkNow() {
    const result = await check.refetch();
    if (result.isError) toast.error("Suche nach Updates fehlgeschlagen");
    else if (!result.data) toast.success("betterjira ist aktuell");
  }

  return {
    autoCheck: preferences.autoCheck,
    autoInstall: preferences.autoInstall,
    setAutoCheck: preferences.setAutoCheck,
    setAutoInstall: preferences.setAutoInstall,
    currentVersion: current,
    available: check.data?.version ?? null,
    checking: check.isFetching,
    checkNow,
    releases: (releases.data ?? []).map((release) => ({
      value: release.version,
      label: release.version,
      hint: release.version === current ? "installiert" : publishedLabel(release.publishedAt ?? undefined),
    })),
    releasesLoading: releases.isPending,
    releasesError: releases.isError,
    selected: target,
    setSelected,
    direction,
    percent,
    installing: install.isPending,
    installSelected: () => {
      if (target && !install.isPending) install.mutate(target);
    },
  };
}

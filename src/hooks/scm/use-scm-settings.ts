import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepoLink, ScmConnection } from "@/lib/scm/model";

type ScmSettingsState = {
  connections: ScmConnection[];
  repoLinks: Record<string, RepoLink[]>;
  addConnection: (connection: ScmConnection) => void;
  removeConnection: (id: string) => void;
  linkRepo: (projectKey: string, link: RepoLink) => void;
  unlinkRepo: (projectKey: string, link: RepoLink) => void;
};

const sameLink = (a: RepoLink, b: RepoLink) => a.connectionId === b.connectionId && a.repo === b.repo;

const NO_LINKS: RepoLink[] = [];

export const useScmSettings = create<ScmSettingsState>()(
  persist(
    (set) => ({
      connections: [],
      repoLinks: {},
      addConnection: (connection) => set(({ connections }) => ({ connections: [...connections, connection] })),
      removeConnection: (id) =>
        set(({ connections, repoLinks }) => ({
          connections: connections.filter((connection) => connection.id !== id),
          repoLinks: Object.fromEntries(
            Object.entries(repoLinks).map(([key, links]) => [key, links.filter((link) => link.connectionId !== id)]),
          ),
        })),
      linkRepo: (projectKey, link) =>
        set(({ repoLinks }) => {
          const links = repoLinks[projectKey] ?? [];
          return links.some((existing) => sameLink(existing, link)) ? {} : { repoLinks: { ...repoLinks, [projectKey]: [...links, link] } };
        }),
      unlinkRepo: (projectKey, link) =>
        set(({ repoLinks }) => ({
          repoLinks: { ...repoLinks, [projectKey]: (repoLinks[projectKey] ?? []).filter((existing) => !sameLink(existing, link)) },
        })),
    }),
    { name: "betterjira-scm" },
  ),
);

export const useRepoLinks = (projectKey: string | undefined) =>
  useScmSettings((state) => (projectKey ? (state.repoLinks[projectKey] ?? NO_LINKS) : NO_LINKS));

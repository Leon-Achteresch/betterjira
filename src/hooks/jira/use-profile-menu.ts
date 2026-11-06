import { openUrl } from "@tauri-apps/plugin-opener";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useJiraLogin, useJiraLogout, useJiraMyself } from "@/lib/jira/queries";

export function useProfileMenu() {
  const session = useJiraSession();
  const myself = useJiraMyself();
  const login = useJiraLogin();
  const logout = useJiraLogout();
  const name = myself.data?.displayName ?? "";
  const siteUrl = session.site?.siteUrl;

  return {
    session,
    name,
    initials: name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2),
    email: myself.data?.emailAddress,
    avatarUrl: myself.data?.avatarUrls["48x48"],
    login,
    logout,
    openSite: siteUrl ? () => void openUrl(siteUrl) : undefined,
  };
}

export type ProfileMenuState = ReturnType<typeof useProfileMenu>;

import type { ReactNode } from "react";
import { Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { useNotificationPoller } from "@/lib/jira/notifications";
import { AdfLinkContext } from "@/components/adf-content";
import { useAppLinkHandler } from "@/hooks/use-app-link-handler";
import { useAttentionScheduler } from "@/hooks/attention/use-attention-scheduler";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useBackgroundTabClick } from "@/hooks/use-issue-tabs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/motion/page-transition";
import { ShortcutHelp } from "@/components/shell/shortcut-help";
import { UpdateCard } from "@/components/shell/update-card";
import { useAppShortcuts } from "@/hooks/use-app-shortcuts";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";

function NotificationPoller() {
  useNotificationPoller();
  return null;
}

function AttentionScheduler() {
  useAttentionScheduler();
  return null;
}

function AppUpdater() {
  const app = useAppUpdate();
  return (
    <UpdateCard
      update={app.update}
      percent={app.percent}
      failed={app.failed}
      onInstall={app.install}
      onDismiss={app.dismiss}
      onSkip={app.skip}
      onReleaseNotes={app.openReleaseNotes}
    />
  );
}

function BackgroundTabClick() {
  useBackgroundTabClick();
  return null;
}

function AdfLinks({ children }: { children: ReactNode }) {
  const openLink = useAppLinkHandler();
  return <AdfLinkContext value={openLink}>{children}</AdfLinkContext>;
}

function Shortcuts() {
  const help = useAppShortcuts();
  return <ShortcutHelp open={help.open} onOpenChange={help.setOpen} groups={SHORTCUT_GROUPS} />;
}

function Page() {
  const id = useRouterState({ select: (state) => state.matches[1]?.pathname ?? "/" });
  return (
    <PageTransition id={id}>
      <Outlet />
    </PageTransition>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <AdfLinks>
          <SidebarProvider className="h-dvh min-h-0 flex-col">
            <AppHeader />
            <div className="flex min-h-0 flex-1">
              <AppSidebar />
              <SidebarInset id="app-scroll" data-scroll-restoration-id="app-scroll" className="min-h-0 overflow-auto">
                <Page />
              </SidebarInset>
            </div>
          </SidebarProvider>
          <Toaster />
          <Shortcuts />
          <NotificationPoller />
          <AttentionScheduler />
          <AppUpdater />
          <BackgroundTabClick />
        </AdfLinks>
      </TooltipProvider>
    </ThemeProvider>
  ),
});

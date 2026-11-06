import { Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { useNotificationPoller } from "@/lib/jira/notifications";
import { useAttentionScheduler } from "@/hooks/attention/use-attention-scheduler";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useBackgroundTabClick } from "@/hooks/use-issue-tabs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/motion/page-transition";
import { ShortcutHelp } from "@/components/shell/shortcut-help";
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
  useAppUpdate();
  return null;
}

function BackgroundTabClick() {
  useBackgroundTabClick();
  return null;
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
      </TooltipProvider>
    </ThemeProvider>
  ),
});

import { Outlet, createRootRouteWithContext, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
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
import { UpdateCard } from "@/components/shell/update-card";
import { useAppShortcuts } from "@/hooks/use-app-shortcuts";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { RenderErrorBoundary } from "@/components/ui/render-error-boundary";
import { RenderError } from "@/components/shell/render-error";
import { useRenderRecovery } from "@/hooks/use-render-recovery";

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

function Shortcuts() {
  const help = useAppShortcuts();
  return <ShortcutHelp open={help.open} onOpenChange={help.setOpen} groups={SHORTCUT_GROUPS} />;
}

function Page() {
  const id = useRouterState({ select: (state) => state.matches[1]?.pathname ?? "/" });
  const recovery = useRenderRecovery();
  return (
    <PageTransition id={id}>
      <RenderErrorBoundary
        resetKeys={[recovery.resetKey]}
        onReset={recovery.invalidateFailed}
        fallback={({ retries, reset }) => <RenderError scope="page" retries={retries} onRetry={reset} onReload={recovery.reload} />}
      >
        <Outlet />
      </RenderErrorBoundary>
    </PageTransition>
  );
}

function RootError({ reset }: ErrorComponentProps) {
  const recovery = useRenderRecovery();
  const retry = () => {
    recovery.invalidateFailed();
    reset();
  };
  return <RenderError scope="app" onRetry={retry} onReload={recovery.reload} className="h-dvh bg-background" />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  errorComponent: RootError,
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

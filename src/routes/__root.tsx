import { Outlet, createRootRouteWithContext, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { useNotificationPoller } from "@/hooks/notifications/use-notification-poller";
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
import { RouteNotFound } from "@/components/shell/route-not-found";
import { useRouteNotFound } from "@/hooks/use-route-not-found";
import { useRenderRecovery } from "@/hooks/use-render-recovery";
import { OfflineNotice } from "@/components/connections/offline-notice";
import { useDeviceOnline } from "@/hooks/connections/use-device-online";

import { useReadabilitySync } from "@/hooks/use-readability";

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

function ReadabilitySync() {
  useReadabilitySync();
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

function DeviceOfflineNotice() {
  return <OfflineNotice visible={!useDeviceOnline()} />;
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

function NotFound() {
  const notFound = useRouteNotFound();
  return <RouteNotFound canGoBack={notFound.canGoBack} onBack={notFound.goBack} onHome={notFound.goHome} />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  errorComponent: RootError,
  notFoundComponent: NotFound,
  component: () => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ReadabilitySync />
      <TooltipProvider>
        <SidebarProvider className="h-dvh min-h-0 flex-col">
          <AppHeader />
          <div className="flex min-h-0 flex-1">
            <AppSidebar />
            <SidebarInset id="app-scroll" data-scroll-restoration-id="app-scroll" className="min-h-0 overflow-auto">
              <DeviceOfflineNotice />
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

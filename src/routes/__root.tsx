import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { useNotificationPoller } from "@/lib/jira/notifications";
import { useAttentionScheduler } from "@/hooks/attention/use-attention-scheduler";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function NotificationPoller() {
  useNotificationPoller();
  return null;
}

function AttentionScheduler() {
  useAttentionScheduler();
  return null;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <TooltipProvider>
      <SidebarProvider className="h-dvh min-h-0 flex-col">
        <AppHeader />
        <div className="flex min-h-0 flex-1">
          <AppSidebar />
          <SidebarInset className="min-h-0 overflow-auto">
            <Outlet />
          </SidebarInset>
        </div>
      </SidebarProvider>
      <Toaster />
      <NotificationPoller />
      <AttentionScheduler />
    </TooltipProvider>
  ),
});

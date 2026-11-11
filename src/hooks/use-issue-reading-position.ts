import { useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { useWorkspace, useWorkspaceStore } from "@/hooks/use-workspace";
import { setIssueContext } from "@/lib/workspace";

export function useIssueReadingPosition(issueKey: string, loaded: boolean, jumpPending: boolean) {
  const { id } = useWorkspace();
  const jumping = useRef(jumpPending);
  useLayoutEffect(() => {
    jumping.current = jumpPending;
  });

  useLayoutEffect(() => {
    if (!id || !loaded) return;
    const container = document.querySelector<HTMLElement>('[data-slot="sidebar-inset"]');
    const article = container?.querySelector("article");
    if (!container || !article) return;
    const store = useWorkspaceStore.getState();
    const target = Math.max(0, store.workspaces[id]?.contexts?.[issueKey]?.scrollTop ?? 0);
    let position = target;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let restoring = true;
    let stopped = false;
    let active = true;
    const save = () => store.update(id, (workspace) => setIssueContext(workspace, issueKey, { scrollTop: position }));
    const observer = new ResizeObserver(() => restore());
    const finishRestoring = (restored = false) => {
      position = container.scrollTop;
      restoring = false;
      observer.disconnect();
      if (restored && target > 80)
        toast("An letzter Lesestelle fortgesetzt", {
          id: `reading:${issueKey}`,
          duration: 3000,
          action: {
            label: "Zum Anfang",
            onClick: () => {
              if (!active) return;
              interact();
              container.scrollTop = 0;
              position = 0;
              save();
            },
          },
        });
    };
    const restore = () => {
      if (stopped) return;
      container.scrollTop = target;
      if (Math.abs(container.scrollTop - target) < 2) finishRestoring(true);
    };
    const interact = () => {
      stopped = true;
      finishRestoring();
    };
    const onScroll = () => {
      if (restoring) return;
      position = container.scrollTop;
      clearTimeout(timer);
      timer = setTimeout(save, 200);
    };
    if (jumping.current) interact();
    else {
      observer.observe(article);
      restore();
    }
    const deadline = setTimeout(() => finishRestoring(), 1500);
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("wheel", interact, { passive: true, once: true });
    container.addEventListener("pointerdown", interact, { passive: true, once: true });
    container.addEventListener("keydown", interact, { once: true });
    window.addEventListener("pagehide", save);

    return () => {
      active = false;
      toast.dismiss(`reading:${issueKey}`);
      clearTimeout(timer);
      clearTimeout(deadline);
      observer.disconnect();
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("wheel", interact);
      container.removeEventListener("pointerdown", interact);
      container.removeEventListener("keydown", interact);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [id, issueKey, loaded]);
}

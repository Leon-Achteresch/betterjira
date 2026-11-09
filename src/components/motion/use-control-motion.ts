import { useEffect, useImperativeHandle, type Ref } from "react";
import { hover, useAnimate, useReducedMotion } from "motion/react";
import { SPRING_PRESS } from "@/lib/ease";

export function useControlMotion<T extends HTMLElement>({
  ref,
  disabled = false,
  hoverScale = 1.015,
}: { ref?: Ref<T>; disabled?: boolean; hoverScale?: number } = {}) {
  const [scope, animate] = useAnimate<T>();
  const reduce = useReducedMotion();
  useImperativeHandle(ref, () => scope.current, [scope]);

  useEffect(() => {
    const element = scope.current;
    if (!element || disabled || reduce) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let hovering = false;
    let pressing = false;
    const update = () =>
      animate(
        element,
        { scale: pressing ? 0.97 : hovering ? hoverScale : 1 },
        SPRING_PRESS,
      );
    const release = () => {
      if (!pressing) return;
      pressing = false;
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      update();
    };
    const stopHover = hover(element, () => {
      hovering = true;
      update();
      return () => {
        hovering = false;
        update();
      };
    });
    element.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        pressing = true;
        window.addEventListener("pointerup", release, options);
        window.addEventListener("pointercancel", release, options);
        update();
      },
      options,
    );
    element.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        pressing = true;
        update();
      },
      options,
    );
    element.addEventListener(
      "keyup",
      (event) => {
        if (event.key === "Enter" || event.key === " ") release();
      },
      options,
    );
    element.addEventListener("blur", release, options);
    return () => {
      controller.abort();
      stopHover();
      animate(element, { scale: 1 }, { duration: 0 });
    };
  }, [animate, disabled, hoverScale, reduce, scope]);

  return scope;
}

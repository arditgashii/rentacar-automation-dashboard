"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Confirm = { ask: (title: string, body: React.ReactNode, action: string, run: () => void) => void };

/**
 * Leaving with unsaved changes asks first: the browser asks for reloads and closing the tab, our
 * dialog for links inside the app. `onLeave` runs before the navigation (to drop the changes).
 */
export function useLeaveGuard(dirty: boolean, confirm: Confirm, body: string, onLeave?: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank" || !anchor.href.startsWith(window.location.origin)) return;
      event.preventDefault();
      event.stopPropagation();
      confirm.ask("Leave without saving?", body, "Leave", () => {
        onLeave?.();
        router.push(anchor.href.slice(window.location.origin.length));
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, confirm, body, onLeave, router]);
}

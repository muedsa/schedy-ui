import { useEffect } from "react";

let lockCount = 0;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    document.body.classList.add("no-scroll");
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.classList.remove("no-scroll");
    };
  }, [active]);
}

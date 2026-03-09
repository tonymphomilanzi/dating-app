// src/hooks/usePreventSwipeScroll.js
import { useEffect } from "react";

export function usePreventSwipeScroll(isDragging) {
  useEffect(() => {
    if (!isDragging) return;

    const preventScroll = (e) => {
      e.preventDefault();
    };

    // Prevent scroll on body
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [isDragging]);
}
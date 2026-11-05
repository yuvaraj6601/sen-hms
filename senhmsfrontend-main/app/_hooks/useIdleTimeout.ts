"use client";

import { useEffect, useRef, useCallback } from "react";

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "click",
] as const;

/**
 * Calls `onIdle` after `timeoutMs` of inactivity.
 * Resets the timer on any user activity.
 */
export function useIdleTimeout(onIdle: () => void, timeoutMs: number) {
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef   = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    reset();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [reset]);
}

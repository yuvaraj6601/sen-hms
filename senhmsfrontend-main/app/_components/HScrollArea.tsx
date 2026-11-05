"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface HScrollAreaProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal scroll wrapper that renders a second, synchronized scrollbar
 * pinned to the TOP of the content. Fixes the common UX issue where a wide
 * table's only scrollbar sits at the bottom — forcing the user to scroll the
 * whole page down just to reach it.
 *
 * - The top bar and the real content scroll in lock-step.
 * - The top bar only appears when the content actually overflows horizontally.
 * - On resize/content change the bar width re-syncs to the content width.
 */
export default function HScrollArea({ children, className = "" }: HScrollAreaProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  // Guard so the two scroll handlers don't fight each other.
  const syncing = useRef(false);

  // Measure content and show the top bar only when it overflows.
  const measure = useCallback(() => {
    const body = bodyRef.current;
    const spacer = spacerRef.current;
    if (!body || !spacer) return;
    spacer.style.width = `${body.scrollWidth}px`;
    setOverflow(body.scrollWidth > body.clientWidth + 1);
  }, []);

  useEffect(() => {
    measure();
    const body = bodyRef.current;
    if (!body) return;
    // Re-measure when the viewport or the content size changes.
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    if (body.firstElementChild) ro.observe(body.firstElementChild);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure, children]);

  function onTopScroll() {
    if (syncing.current) { syncing.current = false; return; }
    if (topRef.current && bodyRef.current) {
      syncing.current = true;
      bodyRef.current.scrollLeft = topRef.current.scrollLeft;
    }
  }

  function onBodyScroll() {
    if (syncing.current) { syncing.current = false; return; }
    if (topRef.current && bodyRef.current) {
      syncing.current = true;
      topRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  }

  return (
    <div className={className}>
      {/* Top synced scrollbar — only shown when the content overflows. */}
      <div
        ref={topRef}
        onScroll={onTopScroll}
        className="overflow-x-auto overflow-y-hidden"
        style={{ display: overflow ? "block" : "none" }}
        aria-hidden="true"
      >
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>

      {/* Real content with its own (bottom) scrollbar. */}
      <div ref={bodyRef} onScroll={onBodyScroll} className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

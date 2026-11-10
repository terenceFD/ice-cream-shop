import { useEffect, useRef } from "react";

/**
 * Adds scroll-into-view reveals to every element with the `scroll-reveal`
 * class inside the returned container ref: an IntersectionObserver watches
 * each one and adds `scroll-reveal-in` the first time it enters the viewport,
 * then stops observing it. Cards above the fold reveal immediately on mount.
 *
 * Pairs with the .scroll-reveal / .scroll-reveal-in classes in index.css,
 * which no-op under prefers-reduced-motion.
 *
 * Sibling elements that share a parent get an automatic stagger (set as the
 * --reveal-delay custom property), so a grid of cards cascades in as a wave
 * instead of popping in simultaneously. The stagger is computed per parent,
 * capped, and applied once at setup — never during scroll.
 */

const STAGGER_MS = 90;
const MAX_STAGGER_SIBLINGS = 6;
export function useScrollReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targets = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".scroll-reveal:not(.scroll-reveal-in)",
      ),
    );
    if (!targets.length) return;

    // Wave reveal: each sibling group staggers left-to-right, capped so a long
    // grid never leaves its tail cards waiting half a second before appearing.
    const groups = new Map<HTMLElement, number>();
    for (const target of targets) {
      const parent = target.parentElement;
      if (!parent) continue;
      const index = groups.get(parent) ?? 0;
      target.style.setProperty(
        "--reveal-delay",
        `${Math.min(index, MAX_STAGGER_SIBLINGS) * STAGGER_MS}ms`,
      );
      groups.set(parent, index + 1);
    }

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("scroll-reveal-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("scroll-reveal-in");
          observer.unobserve(entry.target);
        }
      },
      // Reveal just before a card reaches the bottom edge so the motion is visible
      // while scrolling without ever showing an empty grid gap.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

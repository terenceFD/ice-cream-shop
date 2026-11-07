import { useEffect, useState } from "react";

/**
 * Where the floating widgets (chat launcher, currency switcher) should be.
 *
 * They belong to the middle of the page: a visitor reading the menu, the cakes or the
 * reviews may want to ask something or change the display currency. Over the hero and
 * the footer they are in the way, so they step aside there and come back afterwards.
 *
 * The page marks its bookends with `data-floating-hide="hero"` (top of the page) and
 * `data-floating-hide="footer"` (bottom). Every other section is "the middle". A page
 * without a hero marker is middle from the very top; one without a footer marker is
 * middle to the very bottom. One scroll listener here serves every widget.
 */
const HERO_SELECTOR = '[data-floating-hide="hero"]';
const FOOTER_SELECTOR = '[data-floating-hide="footer"]';

type State = {
  /** False until the first measurement, so the widgets are not drawn misplaced. */
  measured: boolean;
  /** True when every bookend is scrolled past and the visitor is in the middle. */
  inMiddle: boolean;
};

let state: State = { measured: false, inMiddle: false };
const listeners = new Set<(next: State) => void>();

function publish(next: State) {
  if (next.measured === state.measured && next.inMiddle === state.inMiddle)
    return;
  state = next;
  for (const listener of listeners) listener(next);
}

/** Called once by the shell to keep the state in step with the scroll position. */
export function useTrackFloatingWidgets() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = document.querySelector(HERO_SELECTOR);
      const footer = document.querySelector(FOOTER_SELECTOR);
      if (!hero && !footer) {
        // No bookends at all: treat the whole page as the middle so the widgets show.
        publish({ measured: true, inMiddle: true });
        return;
      }
      const viewport = window.innerHeight;
      // The hero ends where its bottom edge passes the top; the footer begins where its
      // top edge enters from below. A page with no hero is middle from the top; one with
      // no footer is middle to the bottom. In between, the widgets are welcome.
      const heroBottom = hero
        ? hero.getBoundingClientRect().bottom
        : Number.NEGATIVE_INFINITY;
      const footerTop = footer
        ? footer.getBoundingClientRect().top
        : Number.POSITIVE_INFINITY;
      publish({
        measured: true,
        inMiddle: heroBottom <= 0 && footerTop > viewport,
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}

export function useShowFloatingWidgets() {
  const [value, setValue] = useState<State>(state);
  useEffect(() => {
    listeners.add(setValue);
    setValue(state);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value.measured && value.inMiddle;
}

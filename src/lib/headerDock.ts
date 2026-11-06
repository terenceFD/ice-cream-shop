import { useEffect, useState } from "react";

// Where the floating widgets (chat launcher, currency switcher, back to top) should sit.
//
// The header is sticky and grows a shadow once the page scrolls. While it is on screen
// the widgets tuck under it, out of the way; once it has scrolled away they take the
// bottom corner as usual. Publishing the offset on <html> keeps one scroll listener for
// every widget and lets the CSS do the positioning.
const HEADER_HEIGHT_PX = 80;
const DOCK_EVENT = "site-header-dock";

let currentOffset = 0;

function readPublished() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--site-dock-offset",
  );
  return Number.parseFloat(raw) || 0;
}

function publish(offset: number) {
  currentOffset = offset;
  const root = document.documentElement;
  if (offset > 0) root.style.setProperty("--site-dock-offset", `${offset}px`);
  else root.style.removeProperty("--site-dock-offset");
  window.dispatchEvent(new CustomEvent(DOCK_EVENT, { detail: offset }));
}

/** Called once by the header to keep the dock offset in step with the scroll position. */
export function usePublishDockOffset() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // Hide the moment the header's bottom edge has climbed off the top of the screen,
      // so the widgets are gone before they can reach it.
      const offset =
        window.scrollY >= HEADER_HEIGHT_PX ? HEADER_HEIGHT_PX + 12 : 0;
      publish(offset);
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
      publish(0);
    };
  }, []);
}

/** The current dock offset, for widgets that need to hide rather than move. */
export function useDockOffset() {
  const [offset, setOffset] = useState(readPublished);

  useEffect(() => {
    // Catch a change published between the render and this subscription.
    setOffset(currentOffset);
    const onDock = (event: Event) => {
      setOffset(Number((event as CustomEvent<number>).detail) || 0);
    };
    window.addEventListener(DOCK_EVENT, onDock);
    return () => window.removeEventListener(DOCK_EVENT, onDock);
  }, []);

  return offset;
}

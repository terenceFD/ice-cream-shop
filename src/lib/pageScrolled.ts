import { useEffect, useState } from "react";

// True once the visitor has scrolled past the sticky header. Floating widgets pinned to
// the screen corners read this so they appear with the hero and only then take over the
// corner, instead of sitting over the first screen of content.
const HEADER_HEIGHT_PX = 80;

export function useScrolledPastHeader() {
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > HEADER_HEIGHT_PX,
  );

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > HEADER_HEIGHT_PX);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return scrolled;
}

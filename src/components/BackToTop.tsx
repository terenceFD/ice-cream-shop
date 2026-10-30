import { useEffect, useState } from "react";
import { useLanguage } from "../language/useLanguage";

// The button appears once the visitor is well past the header, not as soon as they scroll a
// little: on a short page it would sit there for no reason.
const SHOW_AFTER_VIEWPORTS = 1.5;

export function BackToTop() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > window.innerHeight * SHOW_AFTER_VIEWPORTS);
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

  const toTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // Move keyboard focus back to the start of the page, so tabbing continues from the top.
    const main = document.getElementById("main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  };

  return (
    <button
      aria-hidden={!visible}
      aria-label={t("Back to top")}
      className={`site-back-to-top ${visible ? "site-back-to-top--visible" : ""}`}
      onClick={toTop}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 19V5m0 0-6 6m6-6 6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <span className="sr-only">{t("Back to top")}</span>
    </button>
  );
}

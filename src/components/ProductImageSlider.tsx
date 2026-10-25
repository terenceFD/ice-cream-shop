import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../language/useLanguage";
import { photoErrorHandler, photoSrcSet, thumbnail } from "../lib/thumbnails";

const SWIPE_DISTANCE = 40;
const FALLBACK_IMAGE = "/images/hero-ice-cream.jpg";
const AUTOPLAY_DELAY = 4000;

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

interface ProductImageSliderProps {
  /** Main photo first, then the other views of the same product. */
  images: string[];
  /** Translated product name, used for the photos' descriptions. */
  name: string;
  /** Aspect ratio and filter classes for each photo. */
  imageClassName?: string;
  /** Background class of the photo frame. */
  frameClassName?: string;
  /** Badges shown over the photos, such as availability. */
  overlay?: ReactNode;
  /** Reserve eager, high-priority loading for the primary image above the fold. */
  priority?: boolean;
  /** Hide the thumbnail strip when the surrounding card needs a shorter footprint. */
  showThumbnails?: boolean;
  /** Hide the decorative photo scrim when the image is already clearly labeled. */
  showScrim?: boolean;
  /** Rendered width of the image, used to select the smallest suitable srcset entry. */
  sizes?: string;
  /** Changing this value returns the slider to the first photo. */
  resetKey?: string | number;
}

// Product photos with arrows, thumbnails, swipe on touch screens and left/right arrow keys.
// Photos advance every few seconds, pausing while a mouse rests on them or a keyboard user is inside.
// A single photo shows on its own, without controls.
export function ProductImageSlider({ images: sourceImages, name, imageClassName = "aspect-square", frameClassName = "bg-[#fbfaf5]", overlay, priority = false, showThumbnails = true, showScrim = true, sizes = "(min-width: 1024px) 600px, 100vw", resetKey }: ProductImageSliderProps) {
  const { t } = useLanguage();
  const images = [...new Set(sourceImages.filter(Boolean))];
  const [active, setActive] = useState(0);
  // Visitors who ask for reduced motion start paused and can press play.
  const [paused, setPaused] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const hasSlides = images.length > 1;
  const current = Math.min(active, images.length - 1);

  useEffect(() => setActive(0), [resetKey]);

  // Advance on its own; any manual change restarts the countdown.
  useEffect(() => {
    if (!hasSlides || paused || hovered) return;
    const timer = window.setTimeout(() => setActive((current + 1) % images.length), AUTOPLAY_DELAY);
    return () => window.clearTimeout(timer);
  }, [current, hasSlides, hovered, images.length, paused]);

  const go = (index: number) => setActive((index + images.length) % images.length);

  return (
    <div
      aria-label={hasSlides ? t("Photos of {name}", { name }) : undefined}
      aria-roledescription={hasSlides ? t("carousel") : undefined}
      className="outline-none"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }}
      onFocus={(event) => { if (event.target.matches(":focus-visible")) setHovered(true); }}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
      onKeyDown={(event) => {
        if (!hasSlides) return;
        if (event.key === "ArrowLeft") { event.preventDefault(); go(current - 1); }
        if (event.key === "ArrowRight") { event.preventDefault(); go(current + 1); }
      }}
      role={hasSlides ? "region" : undefined}
    >
      <div
        className={`group relative touch-pan-y overflow-hidden rounded-[32px] shadow-[0_30px_70px_rgba(9,42,83,0.16)] ${frameClassName}`}
        onPointerDown={(event) => { swipeStart.current = event.clientX; }}
        onPointerUp={(event) => {
          if (swipeStart.current === null || !hasSlides) return;
          const distance = event.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(distance) >= SWIPE_DISTANCE) go(current + (distance < 0 ? 1 : -1));
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {images.map((image, index) => {
            const last = (current + images.length - 1) % images.length;
            const next = (current + 1) % images.length;
            // Keep the strip width stable, but download only the visible photo and its neighbors.
            if (index !== current && index !== next && index !== last) {
              return <div aria-hidden="true" className={`w-full shrink-0 ${imageClassName}`} key={image} />;
            }
            return (
              <img decoding="async"
                alt={index === current ? name : t("{name}, photo {number} of {total}", { name, number: index + 1, total: images.length })}
                aria-hidden={index !== current}
                className={`w-full shrink-0 select-none object-cover ${imageClassName}`}
                draggable={false}
                fetchPriority={priority && index === current ? "high" : "auto"}
                key={image}
                loading={priority && index === current ? "eager" : "lazy"}
                sizes={sizes}
                srcSet={photoSrcSet(image)}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = FALLBACK_IMAGE;
                }}
                src={image}
              />
            );
          })}
        </div>
        {showScrim && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061d3a]/30 via-transparent to-transparent" />
        )}
        {overlay}
        {hasSlides && showThumbnails && (
          <>
            <div className="absolute right-5 top-5 flex items-center gap-2 sm:right-6 sm:top-6">
              <span aria-live={paused ? "polite" : "off"} className="rounded-full bg-[#092a53]/80 px-3 py-1.5 text-xs font-extrabold tabular-nums text-white backdrop-blur-sm">
                {current + 1} / {images.length}
              </span>
              <button
                aria-label={paused ? t("Play slideshow") : t("Pause slideshow")}
                className="relative grid size-8 place-items-center rounded-full bg-[#092a53]/80 text-white backdrop-blur-sm transition before:absolute before:-inset-1.5 before:content-[''] hover:bg-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                onClick={() => setPaused((value) => !value)}
                type="button"
              >
                <svg aria-hidden="true" className="size-3.5" fill="currentColor" viewBox="0 0 24 24">
                  {paused ? <path d="M8 5.5v13l10.5-6.5z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
                </svg>
              </button>
            </div>
            <button
              aria-label={t("Previous photo")}
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#092a53] shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] sm:left-4 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              onClick={() => go(current - 1)}
              type="button"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              aria-label={t("Next photo")}
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#092a53] shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] sm:right-4 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              onClick={() => go(current + 1)}
              type="button"
            >
              <ChevronIcon direction="right" />
            </button>
            <div aria-hidden="true" className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 sm:hidden">
              {images.map((image, index) => (
                <span className={`h-1.5 rounded-full transition-all ${index === current ? "w-5 bg-white" : "w-1.5 bg-white/55"}`} key={image} />
              ))}
            </div>
          </>
        )}
      </div>

      {showThumbnails && hasSlides && (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.map((image, index) => (
            <li className="shrink-0" key={image}>
              <button
                aria-current={index === current ? "true" : undefined}
                aria-label={t("Show photo {number} of {total}", { number: index + 1, total: images.length })}
                className={`relative block shrink-0 overflow-hidden rounded-2xl ring-2 transition after:absolute after:-inset-2 after:content-[''] focus-visible:outline-none focus-visible:ring-[#092a53] ${
                  index === current ? "ring-[#ffdc32] shadow-[0_8px_20px_rgba(9,42,83,0.18)]" : "opacity-70 ring-transparent hover:opacity-100"
                } ${frameClassName}`}
                onClick={() => setActive(index)}
                type="button"
              >
                <img decoding="async" alt="" className="size-16 object-cover sm:size-20" loading="lazy" onError={photoErrorHandler(image)} src={thumbnail(image, "tiny")} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

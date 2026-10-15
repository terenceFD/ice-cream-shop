// Helpers for showing photos at the right size; the size rules live in photoSizes.js, which the
// server shares. Use thumbnail() for small pictures and photoSrcSet() (with a sizes attribute)
// for pictures whose size depends on the screen.
import { photoAt, photoSrcSet as srcSetFor } from "../../shared/photoSizes.js";

/** "tiny" (160px) for icons-sized pictures up to about 80px, "small" (480px) for up to about 240px. */
export type ThumbnailSize = "tiny" | "small";

export function thumbnail(src: string, size?: ThumbnailSize): string;
export function thumbnail(src: string | null | undefined, size?: ThumbnailSize): string | null | undefined;
export function thumbnail(src: string | null | undefined, size: ThumbnailSize = "small") {
  return src ? photoAt(src, size === "tiny" ? 160 : 480) : src;
}

export function photoSrcSet(src: string | null | undefined): string | undefined {
  return srcSetFor(src);
}

/**
 * onError handler: if a smaller copy is ever missing, show the full photo; if that fails too,
 * show `finalFallback` (when given) instead of a broken image.
 */
export function photoErrorHandler(src: string | null | undefined, finalFallback?: string) {
  return (event: { currentTarget: HTMLImageElement }) => {
    const image = event.currentTarget;
    if (src && !image.dataset.fullPhoto) {
      image.dataset.fullPhoto = "1";
      if (image.srcset || image.getAttribute("src") !== src) {
        image.removeAttribute("srcset");
        image.src = src;
        return;
      }
    }
    if (finalFallback && !image.dataset.finalFallback) {
      image.dataset.finalFallback = "1";
      image.removeAttribute("srcset");
      image.src = finalFallback;
    }
  };
}

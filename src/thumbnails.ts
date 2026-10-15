// Every photo in public/ also has a small copy under /thumbs (480px wide, WebP), made by
// scripts/make-thumbnails.mjs before each build. Use it wherever a photo is shown small, so
// phones do not download a full-size photo for a little picture.
const THUMBNAIL_WIDTH = 480;
const FULL_WIDTH = 900;

function isSitePhoto(src: string | null | undefined): src is string {
  return typeof src === "string"
    && src.startsWith("/")
    && !src.startsWith("//")
    && !src.startsWith("/thumbs/")
    && !src.startsWith("/uploads/")
    && !src.startsWith("/icons/")
    && /^\/[^/]+\/.+\.(webp|jpe?g|png)$/i.test(src.split("?")[0]);
}

/** The small copy of a site photo; any other address (uploads, other sites) is returned unchanged. */
export function thumbnail(src: string): string;
export function thumbnail(src: string | null | undefined): string | null | undefined;
export function thumbnail(src: string | null | undefined) {
  return isSitePhoto(src) ? `/thumbs${src.split("?")[0].replace(/\.(jpe?g|png|webp)$/i, ".webp")}` : src;
}

/** srcSet that lets the browser pick the small copy when it is sharp enough, or the full photo. */
export function photoSrcSet(src: string | null | undefined) {
  return isSitePhoto(src) ? `${thumbnail(src)} ${THUMBNAIL_WIDTH}w, ${src} ${FULL_WIDTH}w` : undefined;
}

/**
 * onError handler: if the small copy is ever missing, show the full photo; if that fails too,
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

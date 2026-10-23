// Photo sizes shared by the pages and the server (which preloads each page's main photo).
// Every photo in public/ also exists in smaller copies under /thumbs/<width>/ (WebP), made by
// scripts/make-thumbnails.mjs before each build. Unsplash photos are resized by Unsplash itself.
export const PHOTO_WIDTHS = [160, 480, 800];
// What the browser is told the original is; most site photos are 900 to 1200px wide.
const FULL_WIDTH = 1200;

export function isSitePhoto(src) {
  return typeof src === "string"
    && src.startsWith("/")
    && !src.startsWith("//")
    && !src.startsWith("/thumbs/")
    && !src.startsWith("/uploads/")
    && !src.startsWith("/icons/")
    && /^\/[^/]+\/.+\.(webp|jpe?g|png)$/i.test(src.split("?")[0]);
}

function isUnsplashPhoto(src) {
  return typeof src === "string" && src.startsWith("https://images.unsplash.com/");
}

/** The copy of a photo at one of PHOTO_WIDTHS; other addresses (uploads, other sites) are returned unchanged. */
export function photoAt(src, width) {
  if (isSitePhoto(src)) return `/thumbs/${width}${src.split("?")[0].replace(/\.(jpe?g|png|webp)$/i, ".webp")}`;
  if (isUnsplashPhoto(src)) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", "70");
    url.searchParams.set("auto", "format");
    return url.toString();
  }
  return src;
}

/** srcset with every size, so the browser downloads the smallest copy that is still sharp. */
export function photoSrcSet(src) {
  if (!isSitePhoto(src) && !isUnsplashPhoto(src)) return undefined;
  return [...PHOTO_WIDTHS.map((width) => `${photoAt(src, width)} ${width}w`), `${src} ${FULL_WIDTH}w`].join(", ");
}

// The large photo in the navy page header (menu, flavors, about): about 360px wide on
// computers and 60% of the screen on phones. The server preloads it with these same values.
export const HERO_PHOTO_SIZES = "(min-width: 1024px) 360px, 60vw";
// Compact headers (shopping pages) show their photo only from this width up: on phones and
// tablets it would sit below the text and push the products a whole screen down.
export const COMPACT_HERO_MEDIA = "(min-width: 1024px)";
// Home hero image: half the grid after its padding and gap on desktop, nearly the whole
// content width on phones. Keep this in sync with the hero preload in index.html.
export const HOME_SLIDE_SIZES = "(min-width: 1320px) 592px, (min-width: 1024px) calc(50vw - 68px), 92vw";
// Round scoop photo on a flavor's own page: at most 500px wide.
export const FLAVOR_PHOTO_SIZES = "(min-width: 1024px) 500px, 90vw";

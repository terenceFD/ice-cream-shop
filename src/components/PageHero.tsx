import { type ReactNode } from "react";
import { photoErrorHandler, photoSrcSet } from "../thumbnails";
import { HERO_PHOTO_SIZES } from "../photoSizes.js";

const FALLBACK_IMAGE = "/images/hero-ice-cream.jpg";

export interface PageHeroStat {
  label: string;
  value: ReactNode;
  /** Shows the value in brand yellow. */
  accent?: boolean;
}

interface PageHeroProps {
  /** Small links above the eyebrow, such as a breadcrumb. */
  breadcrumb?: ReactNode;
  eyebrow: string;
  title: string;
  /** Optional second headline line, shown in brand yellow. */
  subtitle?: string;
  description: string;
  /** Buttons under the description. Use PageHero.primary / PageHero.secondary classes. */
  actions?: ReactNode;
  stats?: PageHeroStat[];
  /** Large arch photo. */
  image?: { src: string; alt: string; position?: string };
  /** Two smaller round photos beside the arch; decorative. */
  sideImages?: [string, string];
  /** Custom artwork shown instead of the photo group. */
  visual?: ReactNode;
  /** Size classes for the visual area; defaults to a 6:5 box. */
  visualClassName?: string;
  /** Floating card over the photos. */
  badge?: { mark: ReactNode; eyebrow: string; text: string };
  /** Text colour class matching the section below, used for the curved edge. */
  curveClassName?: string;
}

function HeroImage({ src, alt, className, position, small = false }: { src: string; alt: string; className: string; position?: string; small?: boolean }) {
  return (
    <img fetchPriority={small ? "auto" : "high"} loading="eager"
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={className}
      decoding="async"
      onError={photoErrorHandler(src, FALLBACK_IMAGE)}
      sizes={small ? "(min-width: 1024px) 170px, 30vw" : HERO_PHOTO_SIZES}
      src={src}
      srcSet={photoSrcSet(src)}
      style={position ? { objectPosition: position } : undefined}
    />
  );
}

// Navy hero shared by the menu and the shop catalog. It continues the navy header,
// with the copy on the left and an arch-framed photo group on the right.
export function PageHero({ breadcrumb, eyebrow, title, subtitle, description, actions, stats = [], image, sideImages, visual, visualClassName = "aspect-[6/5]", badge, curveClassName = "text-[#fbfaf5]" }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#092a53] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-[#3f86d6]/30 blur-[120px]" />
        <div className="absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-[#2d6aa8]/35 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>

      <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 pb-24 pt-8 sm:px-8 sm:pb-28 sm:pt-12 lg:grid-cols-12 lg:gap-8 lg:px-12 lg:pb-32 lg:pt-14">
        <div className="lg:col-span-6">
          {breadcrumb && <div className="mb-8 text-xs font-bold text-white/55">{breadcrumb}</div>}
          <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ffdc32] backdrop-blur-sm">
            <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#ffdc32] text-[10px] text-[#092a53]">✦</span>
            {eyebrow}
          </p>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            {title}
            {subtitle && <span className="mt-3 block text-[0.58em] leading-[1.05] text-[#ffdc32]">{subtitle}</span>}
          </h1>
          <svg aria-hidden="true" className="mt-3 h-3 w-40 text-[#ffdc32] sm:w-52" fill="none" preserveAspectRatio="none" viewBox="0 0 200 12">
            <path d="M2 9C40 3 90 1.5 198 6" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
          </svg>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">{description}</p>
          {actions && <div className="mt-9 flex flex-wrap items-center gap-3">{actions}</div>}
          {stats.length > 0 && (
            <dl className="mt-10 grid w-fit grid-flow-col divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm">
              {stats.map((stat) => (
                <div className="px-5 py-4 sm:px-7" key={stat.label}>
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">{stat.label}</dt>
                  <dd className={`mt-1 font-display text-2xl font-extrabold tabular-nums sm:text-3xl ${stat.accent ? "text-[#ffdc32]" : "text-white"}`}>
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className={`relative mx-auto w-full max-w-[560px] lg:col-span-6 lg:mr-0 ${visualClassName}`}>
          {visual}
          {!visual && image && sideImages && (
            <>
              <div aria-hidden="true" className="absolute bottom-[4%] left-[6%] size-[46%] rounded-full bg-[#ffdc32]" />
              <div aria-hidden="true" className="absolute right-[2%] top-[2%] size-[78%] rounded-full border border-dashed border-white/20" />

              <figure className="absolute bottom-0 right-[4%] h-[94%] w-[60%] overflow-hidden rounded-b-[36px] rounded-t-[999px] bg-[#fff3b8] shadow-[0_40px_80px_rgba(2,12,28,0.45)] ring-[6px] ring-white/10">
                <HeroImage alt={image.alt} className="size-full object-cover" position={image.position} src={image.src} />
              </figure>

              <figure className="absolute left-[4%] top-[6%] size-[30%] overflow-hidden rounded-full bg-[#fff3b8] shadow-[0_20px_44px_rgba(2,12,28,0.4)] ring-[5px] ring-[#092a53]">
                <HeroImage alt="" className="size-full object-cover" small src={sideImages[0]} />
              </figure>
              <figure className="absolute bottom-[10%] left-[18%] size-[24%] overflow-hidden rounded-full bg-[#fff3b8] shadow-[0_20px_44px_rgba(2,12,28,0.4)] ring-[5px] ring-[#092a53]">
                <HeroImage alt="" className="size-full object-cover" small src={sideImages[1]} />
              </figure>
            </>
          )}

          {badge && (
            <div className="absolute -bottom-5 right-0 flex max-w-[300px] items-center gap-3 rounded-2xl bg-white p-3 pr-4 text-[#092a53] shadow-[0_24px_50px_rgba(2,12,28,0.35)] sm:-right-2 sm:p-4">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffdc32] font-display text-sm font-extrabold sm:size-11">
                {badge.mark}
              </span>
              <div className="leading-tight">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8a7000]">{badge.eyebrow}</p>
                <p className="mt-1 text-xs font-bold leading-4 sm:text-sm sm:leading-5">{badge.text}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <svg aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-10 w-full sm:h-14 lg:h-20 ${curveClassName}`} fill="currentColor" preserveAspectRatio="none" viewBox="0 0 1440 80">
        <path d="M0 80V42C240 4 480 0 720 22s480 44 720 4v54H0Z" />
      </svg>
    </section>
  );
}

PageHero.primary =
  "inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-7 py-4 text-sm font-extrabold text-[#092a53] shadow-[0_12px_30px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]";
PageHero.secondary =
  "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.04] px-7 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]";

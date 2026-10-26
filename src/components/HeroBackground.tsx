// Animated hero background: drifting glow blobs, panning dot grid,
// floating sprinkles and twinkling star dots. Purely decorative —
// render it as the first child of a hero section with `isolate`
// so the layers stay behind the content.
//
// Colors are brand-aware: `variant="navy"` (default) suits the dark
// navy heroes, `variant="light"` suits light backgrounds.

const SPRINKLES = [
  { left: "6%", top: "22%", size: 10, delay: "0s", duration: "11s", color: "#ffb84d", shape: "rounded-full" },
  { left: "14%", top: "72%", size: 8, delay: "-3s", duration: "14s", color: "#ff8ab5", shape: "rounded-[3px]" },
  { left: "26%", top: "38%", size: 12, delay: "-6s", duration: "12s", color: "#8fd6ff", shape: "rounded-full" },
  { left: "40%", top: "86%", size: 9, delay: "-1.5s", duration: "15s", color: "#ffb84d", shape: "rounded-[3px]" },
  { left: "55%", top: "14%", size: 7, delay: "-8s", duration: "13s", color: "#ff8ab5", shape: "rounded-full" },
  { left: "66%", top: "58%", size: 11, delay: "-4.5s", duration: "16s", color: "#8fd6ff", shape: "rounded-[3px]" },
  { left: "78%", top: "30%", size: 8, delay: "-2s", duration: "12s", color: "#ffb84d", shape: "rounded-full" },
  { left: "90%", top: "78%", size: 10, delay: "-9s", duration: "14s", color: "#ff8ab5", shape: "rounded-full" },
];

const RECTANGLES = [
  { left: "4%", top: "12%", w: 15, h: 9, delay: "0s", duration: "5.2s", color: "#ffb84d", rotate: -14 },
  { left: "12%", top: "52%", w: 10, h: 7, delay: "-1.4s", duration: "6.1s", color: "#ffffff", rotate: 22 },
  { left: "22%", top: "26%", w: 17, h: 10, delay: "-2.8s", duration: "5.6s", color: "#ffcf85", rotate: -32 },
  { left: "34%", top: "68%", w: 12, h: 8, delay: "-0.9s", duration: "6.8s", color: "#ffb84d", rotate: 40 },
  { left: "41%", top: "6%", w: 9, h: 6, delay: "-3.6s", duration: "4.9s", color: "#ffcf85", rotate: -8 },
  { left: "48%", top: "42%", w: 16, h: 9, delay: "-2.1s", duration: "5.4s", color: "#ffffff", rotate: 16 },
  { left: "58%", top: "14%", w: 11, h: 7, delay: "-4.3s", duration: "6.3s", color: "#ffb84d", rotate: -26 },
  { left: "65%", top: "58%", w: 13, h: 8, delay: "-1.1s", duration: "5.8s", color: "#ffcf85", rotate: 34 },
  { left: "74%", top: "32%", w: 17, h: 10, delay: "-4.7s", duration: "4.7s", color: "#ffffff", rotate: -20 },
  { left: "82%", top: "8%", w: 10, h: 6, delay: "-2.5s", duration: "6.5s", color: "#ffb84d", rotate: 12 },
  { left: "88%", top: "50%", w: 15, h: 9, delay: "-3.9s", duration: "5.1s", color: "#ffcf85", rotate: -38 },
  { left: "95%", top: "76%", w: 11, h: 7, delay: "-0.5s", duration: "5.9s", color: "#ffffff", rotate: 26 },
  { left: "18%", top: "88%", w: 13, h: 8, delay: "-5.2s", duration: "6.0s", color: "#ffb84d", rotate: -18 },
  { left: "63%", top: "84%", w: 16, h: 9, delay: "-4.1s", duration: "5.3s", color: "#ffcf85", rotate: 8 },
  { left: "37%", top: "30%", w: 9, h: 6, delay: "-2.3s", duration: "6.6s", color: "#ffffff", rotate: -44 },
  { left: "70%", top: "74%", w: 12, h: 7, delay: "-1.7s", duration: "5.0s", color: "#ffb84d", rotate: 44 },
  { left: "9%", top: "34%", w: 11, h: 7, delay: "-6.0s", duration: "5.5s", color: "#ffcf85", rotate: 30 },
  { left: "53%", top: "66%", w: 10, h: 6, delay: "-3.3s", duration: "6.2s", color: "#ffffff", rotate: -12 },
];

// Floating circles: round dots in varied brand colors, drifting gently.
const CIRCLES = [
  { left: "8%", top: "18%", size: 14, delay: "-1s", duration: "6.4s", color: "#ff8ab5" },
  { left: "16%", top: "62%", size: 10, delay: "-3.2s", duration: "7.1s", color: "#8fd6ff" },
  { left: "27%", top: "38%", size: 18, delay: "-5s", duration: "6.0s", color: "#ffb84d" },
  { left: "35%", top: "78%", size: 9, delay: "-2.2s", duration: "7.6s", color: "#ffcf85" },
  { left: "45%", top: "24%", size: 12, delay: "-4.4s", duration: "6.8s", color: "#ffffff" },
  { left: "52%", top: "86%", size: 16, delay: "-0.7s", duration: "5.9s", color: "#ff8ab5" },
  { left: "61%", top: "10%", size: 11, delay: "-5.8s", duration: "7.3s", color: "#8fd6ff" },
  { left: "69%", top: "48%", size: 14, delay: "-1.9s", duration: "6.2s", color: "#ffb84d" },
  { left: "77%", top: "20%", size: 9, delay: "-6.4s", duration: "7.8s", color: "#ffcf85" },
  { left: "84%", top: "66%", size: 17, delay: "-2.7s", duration: "6.6s", color: "#ff8ab5" },
  { left: "92%", top: "34%", size: 11, delay: "-4.1s", duration: "7.0s", color: "#8fd6ff" },
  { left: "97%", top: "88%", size: 13, delay: "-0.3s", duration: "6.1s", color: "#ffffff" },
  { left: "31%", top: "8%", size: 10, delay: "-3.7s", duration: "7.4s", color: "#b98aa6" },
  { left: "57%", top: "58%", size: 8, delay: "-5.3s", duration: "6.7s", color: "#ffb84d" },
  { left: "78%", top: "86%", size: 12, delay: "-1.6s", duration: "7.2s", color: "#b98aa6" },
];

// Themed floating shapes per hero subject. Each entry: position, size, timing, colors.
// Shapes are drawn below in one switch so every theme shares the same float animation.
const FLOAT_POSITIONS = [
  { left: "6%", top: "20%", size: 26, delay: "-3s", duration: "13s" },
  { left: "42%", top: "80%", size: 22, delay: "-6s", duration: "15s" },
  { left: "76%", top: "14%", size: 24, delay: "-8s", duration: "14s" },
  { left: "91%", top: "70%", size: 20, delay: "-5s", duration: "16s" },
  { left: "24%", top: "48%", size: 18, delay: "-9s", duration: "13.5s" },
];

const GOLD = "#ffb84d";
const GOLD_LIGHT = "#ffcf85";
const CREAM = "#fff8f0";
const PINK = "#f7a8c4";
const PLUM = "#b98aa6";

// Returns SVG paths for one shape of the chosen theme, at index i of 5.
function themedShape(theme: HeroBackgroundProps["theme"], index: number) {
  switch (theme) {
    case "cake": {
      // Birthday cake: two layers plus a candle flame.
      return (
        <g>
          <rect x="5" y="14" width="14" height="8" rx="1.5" fill="currentColor" opacity="0.28" />
          <rect x="7" y="10" width="10" height="4" rx="1.5" fill="currentColor" opacity="0.4" />
          <rect x="11.2" y="4" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.5" />
          <circle cx="12" cy="3" r="1.4" fill={GOLD_LIGHT} opacity="0.7" />
        </g>
      );
    }
    case "popsicle": {
      // Popsicle on a stick (alternates with a sundae cup).
      if (index % 2 === 0) {
        return (
          <g>
            <rect x="7" y="3" width="10" height="18" rx="5" fill="currentColor" opacity="0.4" />
            <rect x="10.7" y="21" width="2.6" height="8" rx="1.3" fill={CREAM} opacity="0.45" />
          </g>
        );
      }
      return (
        <g>
          {/* Sundae cup with scoops */}
          <circle cx="9" cy="8" r="4" fill="currentColor" opacity="0.4" />
          <circle cx="15" cy="8" r="4" fill="currentColor" opacity="0.32" />
          <path d="M5 12h14l-2.5 9h-9L5 12Z" fill={CREAM} opacity="0.35" />
        </g>
      );
    }
    case "celebration": {
      // Party balloons (alternating sizes) and a gift box.
      if (index % 2 === 0) {
        return (
          <g>
            <ellipse cx="12" cy="9" rx="6" ry="7" fill="currentColor" opacity="0.4" />
            <path d="M12 16v8" stroke={GOLD_LIGHT} strokeWidth="1.4" opacity="0.5" />
          </g>
        );
      }
      return (
        <g>
          <rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor" opacity="0.35" />
          <path d="M12 10v10M5 15h14" stroke={GOLD_LIGHT} strokeWidth="1.6" opacity="0.55" />
          <path d="M12 10c-2-4-7-3-5 1M12 10c2-4 7-3 5 1" stroke={GOLD_LIGHT} strokeWidth="1.4" fill="none" opacity="0.5" />
        </g>
      );
    }
    case "plain":
      return null;
    default: {
      // Ice cream: cone with scoop (alternating with a double-scoop swirl cup).
      if (index % 2 === 0) {
        return (
          <g>
            <circle cx="12" cy="9" r="7" fill="currentColor" opacity="0.4" />
            <path d="M7 16h10l-5 14-5-14Z" fill="currentColor" opacity="0.25" />
          </g>
        );
      }
      return (
        <g>
          <path d="M5 8c0-3 3-5 7-5s7 2 7 5c0 2.2-1.8 4-4 4H9c-2.2 0-4-1.8-4-4Z" fill="currentColor" opacity="0.4" />
          <path d="M8 12h8l-4 9-4-9Z" fill="currentColor" opacity="0.25" />
        </g>
      );
    }
  }
}

const THEME_COLORS: Record<NonNullable<HeroBackgroundProps["theme"]>, string[]> = {
  "ice-cream": [GOLD, GOLD_LIGHT, GOLD, GOLD_LIGHT, GOLD],
  cake: [CREAM, GOLD, CREAM, GOLD_LIGHT, CREAM],
  popsicle: [PINK, GOLD, PINK, GOLD_LIGHT, PINK],
  celebration: [PINK, GOLD, PLUM, GOLD_LIGHT, PINK],
  plain: [],
};

export interface HeroBackgroundProps {
  variant?: "navy" | "light";
  animated?: boolean;
  quietOnMobile?: boolean;
  theme?: "ice-cream" | "cake" | "popsicle" | "celebration" | "plain";
}

export function HeroBackground({
  variant = "navy",
  animated = false,
  quietOnMobile = false,
  theme = "ice-cream",
}: HeroBackgroundProps) {
  const blobs =
    variant === "navy"
      ? [
        { className: "hero-blob-a absolute -right-40 -top-40 size-[38rem]", background: "rgb(255_184_77/0.12)" },
        { className: "hero-blob-b absolute -bottom-56 -left-40 size-[34rem]", background: "rgb(107_63_88/0.5)" },
      ]
      : [
        { className: "hero-blob-a absolute -right-48 -top-48 size-[36rem]", background: "rgb(255_184_77/0.14)" },
        { className: "hero-blob-b absolute -left-40 bottom-0 size-[28rem]", background: "rgb(71_42_59/0.07)" },
      ];

  return (
    <div aria-hidden="true" className={`hero-background pointer-events-none absolute inset-0 -z-10${animated ? "" : " hero-background--static"}${quietOnMobile ? " hero-background--quiet-mobile" : ""}`}>
      {blobs.map((blob, index) => (
        <div
          className={`${blob.className} rounded-full bg-[radial-gradient(closest-side,${blob.background},${blob.background}_35%,transparent)]`}
          key={index}
        />
      ))}
      <div className="hero-grid absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.03)_1px,transparent_1px)] [background-size:28px_28px]" />
      {/* Extra decor: twinkling stars and floating ice-cream shapes */}
      <div className="hero-glow absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(255_184_77/0.14),transparent)]" />
      <div className="absolute inset-0 overflow-hidden">
        {[
          { left: "12%", top: "30%", size: 20, delay: "-2s", duration: "9s", color: GOLD },
          { left: "46%", top: "72%", size: 16, delay: "-5s", duration: "11s", color: GOLD_LIGHT },
          { left: "70%", top: "22%", size: 18, delay: "-7s", duration: "10s", color: GOLD },
          { left: "88%", top: "58%", size: 14, delay: "-4s", duration: "12s", color: GOLD_LIGHT },
          { left: "32%", top: "88%", size: 15, delay: "-8s", duration: "10.5s", color: GOLD },
          { left: "55%", top: "10%", size: 12, delay: "-3s", duration: "9.5s", color: GOLD_LIGHT },
          { left: "8%", top: "64%", size: 13, delay: "-6s", duration: "11.5s", color: GOLD },
          { left: "93%", top: "36%", size: 11, delay: "-9s", duration: "10.5s", color: GOLD_LIGHT },
        ].map((heart, index) => (
          <svg className="hero-heart absolute" key={index} style={{ left: heart.left, top: heart.top, width: heart.size, height: heart.size, color: heart.color, animationDelay: heart.delay, animationDuration: heart.duration }} viewBox="0 0 24 24">
            <path d="M12 21s-7.5-4.9-10-9.4C.5 8.9 1.8 5.5 5 4.5c2-.6 4.2.1 5.6 1.9L12 8l1.4-1.6C14.8 4.6 17 3.9 19 4.5c3.2 1 4.5 4.4 3 7.1C19.5 16.1 12 21 12 21Z" fill="currentColor" opacity="0.35" />
          </svg>
        ))}
      </div>
      <div className="absolute inset-0 overflow-hidden">
        {theme !== "plain" && FLOAT_POSITIONS.map((pos, index) => (
          <svg
            className="hero-shape absolute"
            key={index}
            style={{
              left: pos.left,
              top: pos.top,
              width: pos.size,
              height: pos.size * 1.5,
              color: THEME_COLORS[theme][index % THEME_COLORS[theme].length],
              animationDelay: pos.delay,
              animationDuration: pos.duration,
            }}
            viewBox="0 0 24 36"
          >
            {themedShape(theme, index)}
          </svg>
        ))}
      </div>
      <div className="absolute inset-0 overflow-hidden">
        {SPRINKLES.map((sprinkle, index) => (
          <span
            className={`hero-sprinkle ${sprinkle.shape} absolute`}
            key={index}
            style={{
              left: sprinkle.left,
              top: sprinkle.top,
              width: sprinkle.size,
              height: sprinkle.size * 2.4,
              backgroundColor: sprinkle.color,
              animationDelay: sprinkle.delay,
              animationDuration: sprinkle.duration,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 overflow-hidden">
        {RECTANGLES.map((rect, index) => (
          <span
            className="hero-rect absolute rounded-full"
            key={index}
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.w,
              height: rect.h,
              backgroundColor: rect.color,
              transform: `rotate(${rect.rotate}deg)`,
              opacity: 0.18,
              animationDelay: rect.delay,
              animationDuration: rect.duration,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 overflow-hidden">
        {CIRCLES.map((circle, index) => (
          <span
            className="hero-circle absolute rounded-full"
            key={index}
            style={{
              left: circle.left,
              top: circle.top,
              width: circle.size,
              height: circle.size,
              backgroundColor: circle.color,
              opacity: 0.22,
              animationDelay: circle.delay,
              animationDuration: circle.duration,
            }}
          />
        ))}
      </div>
    </div>
  );
}

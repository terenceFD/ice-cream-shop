// Animated hero background: drifting glow blobs, panning dot grid,
// floating sprinkles and twinkling star dots. Purely decorative —
// render it as the first child of a hero section with `isolate`
// so the layers stay behind the content.
//
// Colors are brand-aware: `variant="navy"` (default) suits the dark
// navy heroes, `variant="light"` suits light backgrounds.

const SPRINKLES = [
  { left: "6%", top: "22%", size: 10, delay: "0s", duration: "11s", color: "#ffdc32", shape: "rounded-full" },
  { left: "14%", top: "72%", size: 8, delay: "-3s", duration: "14s", color: "#ff8ab5", shape: "rounded-[3px]" },
  { left: "26%", top: "38%", size: 12, delay: "-6s", duration: "12s", color: "#8fd6ff", shape: "rounded-full" },
  { left: "40%", top: "86%", size: 9, delay: "-1.5s", duration: "15s", color: "#ffdc32", shape: "rounded-[3px]" },
  { left: "55%", top: "14%", size: 7, delay: "-8s", duration: "13s", color: "#ff8ab5", shape: "rounded-full" },
  { left: "66%", top: "58%", size: 11, delay: "-4.5s", duration: "16s", color: "#8fd6ff", shape: "rounded-[3px]" },
  { left: "78%", top: "30%", size: 8, delay: "-2s", duration: "12s", color: "#ffdc32", shape: "rounded-full" },
  { left: "90%", top: "78%", size: 10, delay: "-9s", duration: "14s", color: "#ff8ab5", shape: "rounded-full" },
];

const STARS = [
  { left: "4%", top: "10%", size: 16, delay: "0s", duration: "3.2s", color: "#ffdc32" },
  { left: "11%", top: "48%", size: 11, delay: "-1.1s", duration: "4.1s", color: "#ffffff" },
  { left: "20%", top: "24%", size: 14, delay: "-2.3s", duration: "3.6s", color: "#ff8ab5" },
  { left: "30%", top: "70%", size: 10, delay: "-0.6s", duration: "4.6s", color: "#8fd6ff" },
  { left: "36%", top: "5%", size: 12, delay: "-3.4s", duration: "3.8s", color: "#ffdc32" },
  { left: "47%", top: "40%", size: 9, delay: "-1.8s", duration: "4.4s", color: "#ffffff" },
  { left: "57%", top: "12%", size: 15, delay: "-2.9s", duration: "3.4s", color: "#ffdc32" },
  { left: "63%", top: "62%", size: 10, delay: "-0.4s", duration: "4.8s", color: "#ff8ab5" },
  { left: "72%", top: "28%", size: 13, delay: "-3.9s", duration: "3.9s", color: "#8fd6ff" },
  { left: "80%", top: "6%", size: 11, delay: "-1.5s", duration: "4.2s", color: "#ffdc32" },
  { left: "86%", top: "52%", size: 16, delay: "-2.1s", duration: "3.5s", color: "#ffffff" },
  { left: "93%", top: "18%", size: 10, delay: "-4.2s", duration: "4.7s", color: "#ff8ab5" },
  { left: "26%", top: "90%", size: 12, delay: "-3.1s", duration: "3.7s", color: "#8fd6ff" },
  { left: "59%", top: "88%", size: 9, delay: "-0.9s", duration: "4.3s", color: "#ffdc32" },
  { left: "8%", top: "62%", size: 13, delay: "-5.2s", duration: "4.5s", color: "#ffdc32" },
  { left: "16%", top: "84%", size: 10, delay: "-2.6s", duration: "3.4s", color: "#ffffff" },
  { left: "24%", top: "6%", size: 9, delay: "-4.7s", duration: "4.9s", color: "#ff8ab5" },
  { left: "33%", top: "52%", size: 15, delay: "-1.3s", duration: "3.3s", color: "#8fd6ff" },
  { left: "43%", top: "24%", size: 11, delay: "-3.8s", duration: "4.0s", color: "#ffdc32" },
  { left: "51%", top: "76%", size: 14, delay: "-0.2s", duration: "3.6s", color: "#ffffff" },
  { left: "60%", top: "34%", size: 10, delay: "-5.5s", duration: "4.4s", color: "#ff8ab5" },
  { left: "69%", top: "78%", size: 12, delay: "-2.4s", duration: "3.8s", color: "#ffdc32" },
  { left: "76%", top: "14%", size: 9, delay: "-4.1s", duration: "4.6s", color: "#8fd6ff" },
  { left: "83%", top: "38%", size: 15, delay: "-1.7s", duration: "3.5s", color: "#ffdc32" },
  { left: "91%", top: "66%", size: 11, delay: "-3.3s", duration: "4.2s", color: "#ffffff" },
  { left: "97%", top: "34%", size: 10, delay: "-0.7s", duration: "4.0s", color: "#ff8ab5" },
  { left: "44%", top: "92%", size: 13, delay: "-2.8s", duration: "3.9s", color: "#ffdc32" },
  { left: "68%", top: "46%", size: 9, delay: "-5.8s", duration: "4.7s", color: "#ff8ab5" },
];

export function HeroBackground({
  variant = "navy",
  animated = false,
}: {
  variant?: "navy" | "light";
  animated?: boolean;
}) {
  const blobs =
    variant === "navy"
      ? [
        { className: "hero-blob-a absolute -right-40 -top-40 size-[38rem]", background: "rgb(255_220_50/0.12)" },
        { className: "hero-blob-b absolute -bottom-56 -left-40 size-[34rem]", background: "rgb(28_79_138/0.5)" },
      ]
      : [
        { className: "hero-blob-a absolute -right-48 -top-48 size-[36rem]", background: "rgb(255_220_50/0.14)" },
        { className: "hero-blob-b absolute -left-40 bottom-0 size-[28rem]", background: "rgb(9_42_83/0.07)" },
      ];

  return (
    <div aria-hidden="true" className={`hero-background pointer-events-none absolute inset-0 -z-10${animated ? "" : " hero-background--static"}`}>
      {blobs.map((blob, index) => (
        <div
          className={`${blob.className} rounded-full bg-[radial-gradient(closest-side,${blob.background},${blob.background}_35%,transparent)]`}
          key={index}
        />
      ))}
      <div className="hero-grid absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.03)_1px,transparent_1px)] [background-size:28px_28px]" />
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
        {STARS.map((star, index) => (
          <svg
            className="hero-star absolute"
            key={index}
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              color: star.color,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
            viewBox="0 0 24 24"
          >
            {/* Four-point sparkle star with a tiny center dot */}
            <path
              d="M12 2c.6 5.4 2 8 4.6 9.4C19.2 12.8 20.4 13.2 22 13.5c-5.4.6-8 2-9.4 4.6C11.2 20.7 10.8 21.9 10.5 23.5c-.6-5.4-2-8-4.6-9.4C3.4 12.7 2.2 12.3.6 12c5.4-.6 8-2 9.4-4.6C11.4 5.9 11.8 4.7 12 2Z"
              fill="currentColor"
            />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          </svg>
        ))}
      </div>
    </div>
  );
}

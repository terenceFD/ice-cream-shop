// Home page UX audit. Scrolls the whole page first (so lazy images and
// IntersectionObserver reveals have run), then measures tap targets, text size,
// contrast and images. Reports the mobile 390px viewport. Read-only.

export default async function run(page) {
  await page.setViewportSize({ width: 390, height: 844 })
  // Walk the page so every lazy image and scroll-reveal has triggered.
  await page.evaluate(async () => {
    const max = Math.min(document.documentElement.scrollHeight, 40_000)
    for (let y = 0; y < max; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 400))
  })

  return await page.evaluate(() => {
    const lum = (color) => {
      const m = color.match(/[\d.]+/g)
      if (!m) return null
      const [r, g, b] = m.slice(0, 3).map((v) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const bgOf = (el) => {
      let node = el
      while (node && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor
        if (bg && bg !== "rgba(0, 0, 0, 0)") return bg
        node = node.parentElement
      }
      return "rgb(255, 255, 255)"
    }
    const contrast = (a, b) => {
      const la = lum(a), lb = lum(b)
      if (la === null || lb === null) return null
      return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100
    }
    const visible = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"
    }
    const label = (el) => (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)

    // Tap targets: under 44x44 is an iOS-spec miss. Expanded pseudo-element hit
    // areas are credited, since those really do catch the tap.
    const undersized = []
    for (const el of document.querySelectorAll("a, button, input, select")) {
      if (!visible(el) || el.closest("[aria-hidden='true']")) continue
      const r = el.getBoundingClientRect()
      const grow = (css) => {
        const s = getComputedStyle(el, css)
        return s.content === "none" ? 0 : Math.abs(parseFloat(s.top) || 0)
      }
      const pad = Math.max(grow("::before"), grow("::after"))
      const w = r.width + pad * 2
      const h = r.height + pad * 2
      if (w < 44 || h < 44) {
        undersized.push({ label: label(el), visible: `${Math.round(r.width)}x${Math.round(r.height)}`, effective: `${Math.round(w)}x${Math.round(h)}` })
      }
    }

    const tinyText = []
    for (const el of document.querySelectorAll("main p, main span, main li, main a, main button, header a, header span, footer p, footer span, footer a")) {
      if (el.children.length || !visible(el)) continue
      const text = el.textContent.trim()
      if (!text) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) tinyText.push({ text: text.slice(0, 40), px: size })
    }

    const lowContrast = []
    const seen = new Set()
    for (const el of document.querySelectorAll("main p, main span, main li, main a, main h1, main h2, main h3, footer p, footer a, header a")) {
      if (el.children.length || !visible(el)) continue
      const text = el.textContent.trim()
      if (text.length < 3) continue
      const cs = getComputedStyle(el)
      const bg = bgOf(el)
      const key = `${cs.color}|${bg}|${cs.fontSize}`
      if (seen.has(key)) continue
      seen.add(key)
      const ratio = contrast(cs.color, bg)
      const size = parseFloat(cs.fontSize)
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700)
      const min = large ? 3 : 4.5
      if (ratio !== null && ratio < min) lowContrast.push({ text: text.slice(0, 40), ratio, min, px: size })
    }

    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map((h) => ({ level: +h.tagName[1], text: h.textContent.trim().slice(0, 45) }))
    const headingJumps = []
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].level - headings[i - 1].level > 1) headingJumps.push(`h${headings[i - 1].level} -> h${headings[i].level}: "${headings[i].text}"`)
    }

    const imgs = [...document.querySelectorAll("img")]
    const footerText = document.querySelector("footer")?.textContent ?? ""
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      pageHeight: document.body.scrollHeight,
      undersizedTargets: undersized,
      tinyText,
      lowContrast,
      headings: headings.slice(0, 30),
      headingJumps,
      contactEmail: footerText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null,
      images: {
        total: imgs.length,
        broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
        missingAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
        noLazyBelowFold: imgs.filter((i) => i.loading !== "lazy" && i.getBoundingClientRect().top > 1500).length,
      },
    }
  })
}

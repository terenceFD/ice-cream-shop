import { createHash } from 'node:crypto'

// The website loader is written straight into index.html (by the Vite plugin in vite.config.ts),
// so the navy screen and logo show the moment the HTML arrives, not a white page while the
// JavaScript downloads. src/components/WebsiteLoader.tsx removes it once the page is on screen.
//
// It only shows on the first page of a visit (per browser tab session) and never in admin.
// This script runs before the body is drawn and marks the page to skip the loader otherwise.
// The server allows exactly this inline script through its Content-Security-Policy hash, so
// any change here changes the hash automatically.
export const BOOT_LOADER_SEEN_KEY = 'cold-stone-loader-seen'

export const BOOT_LOADER_SCRIPT = `(function(){var d=document.documentElement;try{if(location.pathname.indexOf('/admin')===0||sessionStorage.getItem('${BOOT_LOADER_SEEN_KEY}')){d.classList.add('boot-skip');return}sessionStorage.setItem('${BOOT_LOADER_SEEN_KEY}','1')}catch(e){}})()`

export const BOOT_LOADER_SCRIPT_HASH = `'sha256-${createHash('sha256').update(BOOT_LOADER_SCRIPT).digest('base64')}'`

const STYLE = `
#boot-loader{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;color:#fff;background:radial-gradient(ellipse at 50% 42%,#14467f 0%,#092a53 58%,#061d3a 100%);transition:opacity .35s ease,visibility .35s}
.boot-skip #boot-loader{display:none}
#boot-loader.boot-loader--done{opacity:0;visibility:hidden;pointer-events:none}
#boot-loader .bl-content{display:flex;flex-direction:column;align-items:center;text-align:center;padding:2rem}
#boot-loader .bl-mark{position:relative;display:grid;place-items:center;width:7.5rem;height:7.5rem}
#boot-loader .bl-mark::before{content:"";position:absolute;inset:-1.5rem;border-radius:50%;background:radial-gradient(circle,rgba(91,151,224,.35),transparent 70%)}
#boot-loader svg{position:absolute;inset:0;transform:rotate(-90deg)}
#boot-loader circle{fill:none;stroke-width:3}
#boot-loader .bl-track{stroke:rgba(255,255,255,.12)}
#boot-loader .bl-arc{stroke:#ffdc32;stroke-linecap:round;stroke-dasharray:85 255;animation:bl-spin 1.1s linear infinite;transform-origin:60px 60px}
#boot-loader img{position:relative;width:5.5rem;height:5.5rem;border-radius:50%;box-shadow:0 14px 32px rgba(0,0,0,.35)}
#boot-loader .bl-word{margin:1.6rem 0 0;font-family:Fredoka,system-ui,sans-serif;font-size:1.75rem;font-weight:700;line-height:.95;letter-spacing:-.02em}
#boot-loader .bl-word span{display:block;color:#ffdc32}
#boot-loader .bl-msg{margin:.9rem 0 0;font-family:'DM Sans',system-ui,sans-serif;font-size:.875rem;font-weight:500;color:rgba(255,255,255,.72)}
@keyframes bl-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){#boot-loader{transition:none}#boot-loader .bl-arc{animation:none}}
`.trim()

// Goes in <head>: the styles, and the script that decides before the first paint whether to show it.
// Without JavaScript nothing would ever remove it, so it is hidden in that case.
export const BOOT_LOADER_HEAD = `<style>${STYLE}</style>
    <noscript><style>#boot-loader{display:none}</style></noscript>
    <script>${BOOT_LOADER_SCRIPT}</script>`

// Goes first in <body>. The page's language is not known yet, so the line is in English.
export const BOOT_LOADER_BODY = `<div id="boot-loader" role="status" aria-label="Loading">
      <div class="bl-content">
        <div class="bl-mark" aria-hidden="true">
          <svg viewBox="0 0 120 120"><circle class="bl-track" cx="60" cy="60" r="54"/><circle class="bl-arc" cx="60" cy="60" r="54"/></svg>
          <img alt="" src="/icons/icon-192.png" width="88" height="88" decoding="async" fetchpriority="high">
        </div>
        <p class="bl-word" aria-hidden="true">Cold Stone<span>Creamery</span></p>
        <p class="bl-msg">A little sweetness is on its way</p>
      </div>
    </div>`

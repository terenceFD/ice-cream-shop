import { useEffect } from 'react'
import { DEFAULT_IMAGE, pageTitle } from './pageMeta.js'

export interface DocumentMeta {
  title: string
  description: string
  path: string
  image?: string
  index?: boolean
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function setCanonical(href: string | null) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!href) {
    element?.remove()
    return
  }
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }
  element.href = href
}

// Keeps the page head in step with in-app navigation. The server writes the same tags into the
// first HTML response; this updates them when the app changes page without a reload.
export function useDocumentMeta(meta: DocumentMeta | null) {
  const active = meta !== null
  const { title = '', description = '', path = '', image, index = true } = meta || {}
  useEffect(() => {
    if (!active) return
    const url = new URL(path, window.location.origin).href
    const fullTitle = pageTitle(title)
    const imageUrl = new URL(image || DEFAULT_IMAGE, window.location.origin).href
    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('name', 'robots', index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow')
    setCanonical(index ? url : null)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', imageUrl)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', imageUrl)
  }, [active, title, description, path, image, index])
}

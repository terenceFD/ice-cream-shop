/** English lives at the existing addresses. French lives under /fr, same page after that. */

export function splitLanguagePath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/fr') return { language: 'fr', path: '/' }
  if (path.startsWith('/fr/')) return { language: 'fr', path: path.slice(3) || '/' }
  return { language: 'en', path }
}

export function localizedPath(language, path) {
  if (language !== 'fr') return path
  if (path === '/fr' || path.startsWith('/fr/')) return path
  return path === '/' ? '/fr' : `/fr${path}`
}

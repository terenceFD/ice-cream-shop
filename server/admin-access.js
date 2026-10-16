export function storeAdminCanAccess(method, path) {
  const normalizedMethod = method.toUpperCase()
  const normalizedPath = path
    .split('?')[0]
    .replace(/^\/api\/admin(?=\/|$)/, '')
    .replace(/\/+$/, '') || '/'

  if (normalizedMethod === 'GET' && ['/me', '/orders', '/payments', '/customers', '/reviews', '/cake-requests', '/reports', '/stores', '/notifications'].includes(normalizedPath)) return true
  if (normalizedMethod === 'PUT' && normalizedPath === '/profile-picture') return true
  if (normalizedMethod === 'POST' && normalizedPath === '/logout') return true
  if (normalizedMethod === 'PATCH' && /^\/orders\/\d+\/(?:status|delivered)$/.test(normalizedPath)) return true
  if (normalizedMethod === 'DELETE' && /^\/orders\/\d+$/.test(normalizedPath)) return true
  if (normalizedMethod === 'DELETE' && normalizedPath === '/orders/delivered') return true
  if (normalizedMethod === 'DELETE' && /^\/orders\/\d+\/stale-payment$/.test(normalizedPath)) return true
  if (normalizedMethod === 'PATCH' && /^\/reviews\/\d+\/approval$/.test(normalizedPath)) return true
  if (normalizedMethod === 'DELETE' && /^\/reviews\/\d+$/.test(normalizedPath)) return true
  if (normalizedMethod === 'PATCH' && /^\/cake-requests\/\d+\/status$/.test(normalizedPath)) return true
  if (normalizedMethod === 'GET' && normalizedPath === '/event-orders') return true
  if (normalizedMethod === 'PATCH' && /^\/event-orders\/\d+$/.test(normalizedPath)) return true
  if (normalizedMethod === 'PATCH' && /^\/notifications\/\d+\/read$/.test(normalizedPath)) return true
  if (normalizedMethod === 'POST' && /^\/notifications\/\d+\/reply$/.test(normalizedPath)) return true
  if (normalizedMethod === 'DELETE' && normalizedPath === '/notifications') return true
  if (normalizedMethod === 'DELETE' && /^\/notifications\/\d+$/.test(normalizedPath)) return true
  return false
}

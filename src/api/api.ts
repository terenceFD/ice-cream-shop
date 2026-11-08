type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  token?: string
}

type ApiError = {
  error?: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const ADMIN_TOKEN_KEY = 'cold-stone-admin-token'
const CUSTOMER_TOKEN_KEY = 'cold-stone-customer-token'
const ADMIN_WELCOME_KEY = 'cold-stone-admin-welcome'
const ADMIN_CREDENTIALS_CHANGED_KEY = 'cold-stone-admin-credentials-changed'
const ADMIN_STORE_TOWN_KEY = 'cold-stone-admin-store-town-v2'

// The customer token lives in sessionStorage so the sign-in survives reloads and new
// tabs but dies with the tab — a shared computer keeps nobody signed in after the
// browser closes. The server keeps no cookie session; the token is sent per request.
export function getCustomerToken(): string {
  try {
    const token = sessionStorage.getItem(CUSTOMER_TOKEN_KEY)
    if (token) return token
    // Move a token saved by older builds (localStorage) into sessionStorage and
    // wipe it there, so the longer-lived copy is not left behind on disk.
    const legacyToken = localStorage.getItem(CUSTOMER_TOKEN_KEY)
    if (legacyToken) {
      sessionStorage.setItem(CUSTOMER_TOKEN_KEY, legacyToken)
      localStorage.removeItem(CUSTOMER_TOKEN_KEY)
      return legacyToken
    }
    return ''
  } catch {
    return ''
  }
}

export function setCustomerToken(token: string) {
  try {
    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, token)
    // No long-lived copy: remove any token an older build left in localStorage.
    localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  } catch {
    // Storage can be unavailable (private mode); the session then lasts only for this page.
  }
}

export function clearCustomerToken() {
  try {
    sessionStorage.removeItem(CUSTOMER_TOKEN_KEY)
    localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export async function apiRequest<T = any>(path: string, { body, token, ...options }: ApiOptions = {}): Promise<T | null> {
  const headers = new Headers(options.headers)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  // Customer endpoints and optional-auth chat endpoints both need the customer's
  // token when available. Without it, chat messages are stored as guest messages
  // and the admin inbox cannot show the signed-in customer's name.
  const usesCustomerSession = path.startsWith('/customer/') || path.startsWith('/chat/messages')
  const resolvedToken = token ?? (usesCustomerSession ? getCustomerToken() : undefined)
  if (resolvedToken) headers.set('Authorization', `Bearer ${resolvedToken}`)

  let requestPath = path
  if (resolvedToken && path.startsWith('/admin/') && !/[?&]storeTown=/.test(path)) {
    try {
      const storeTown = sessionStorage.getItem(ADMIN_STORE_TOWN_KEY)
      if (storeTown) {
        requestPath += `${path.includes('?') ? '&' : '?'}storeTown=${encodeURIComponent(storeTown)}`
      }
    } catch {
      // Requests can still use the server's unfiltered owner scope when session storage is unavailable.
    }
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}/api${requestPath}`, {
      ...options,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the API server. Make sure the Express backend is running.')
  }

  if (response.status === 204) return null
  let result: ApiError & Record<string, any>
  try {
    result = await response.json()
  } catch {
    if (!response.ok) {
      const endpoint = new URL(`${API_BASE_URL}/api${requestPath}`, window.location.origin).pathname
      throw new Error(`API request failed (${response.status}) for ${options.method || 'GET'} ${endpoint}.`)
    }
    throw new Error('The API server returned an invalid response.')
  }
  if (!response.ok) {
    // Only end the session whose token was rejected, so an expired admin session does not sign the customer out.
    if (response.status === 401 && resolvedToken) {
      if (token === sessionStorage.getItem(ADMIN_TOKEN_KEY)) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY)
        window.dispatchEvent(new Event('admin-session-expired'))
      }
      if (resolvedToken === getCustomerToken()) {
        clearCustomerToken()
        window.dispatchEvent(new Event('customer-session-expired'))
      }
    }
    // The status travels with the error so callers can tell "not allowed" (403) from
    // "server broke" (500) and react differently — the chat widget restarts its thread
    // on a 403 instead of retrying forever.
    const failure = new Error(
      result.error
        || `API request failed (${response.status}) for ${options.method || 'GET'} ${new URL(`${API_BASE_URL}/api${requestPath}`, window.location.origin).pathname}.`,
    ) as Error & { status?: number }
    failure.status = response.status
    throw failure
  }
  return result as T
}

export { ADMIN_TOKEN_KEY, ADMIN_STORE_TOWN_KEY, ADMIN_WELCOME_KEY, ADMIN_CREDENTIALS_CHANGED_KEY, CUSTOMER_TOKEN_KEY }

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

// The customer token lives in localStorage so the sign-in survives reloads, new tabs and browser restarts.
export function getCustomerToken(): string {
  try {
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY)
    if (token) return token
    // Move a token saved by older builds (sessionStorage) over to localStorage.
    const legacyToken = sessionStorage.getItem(CUSTOMER_TOKEN_KEY)
    if (legacyToken) {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, legacyToken)
      sessionStorage.removeItem(CUSTOMER_TOKEN_KEY)
    }
    return legacyToken || ''
  } catch {
    return ''
  }
}

export function setCustomerToken(token: string) {
  try {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
  } catch {
    // Storage can be unavailable (private mode); the session then lasts only for this page.
  }
}

export function clearCustomerToken() {
  try {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY)
    sessionStorage.removeItem(CUSTOMER_TOKEN_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export async function apiRequest<T = any>(path: string, { body, token, ...options }: ApiOptions = {}): Promise<T | null> {
  const headers = new Headers(options.headers)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
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
      const endpoint = new URL(`${API_BASE_URL}/api${path}`, window.location.origin).pathname
      throw new Error(`API request failed (${response.status}) for ${options.method || 'GET'} ${endpoint}.`)
    }
    throw new Error('The API server returned an invalid response.')
  }
  if (!response.ok) {
    // Only end the session whose token was rejected, so an expired admin session does not sign the customer out.
    if (response.status === 401 && token) {
      if (token === sessionStorage.getItem(ADMIN_TOKEN_KEY)) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY)
        window.dispatchEvent(new Event('admin-session-expired'))
      }
      if (token === getCustomerToken()) {
        clearCustomerToken()
        window.dispatchEvent(new Event('customer-session-expired'))
      }
    }
    if (result.error) throw new Error(result.error)
    const endpoint = new URL(`${API_BASE_URL}/api${path}`, window.location.origin).pathname
    throw new Error(`API request failed (${response.status}) for ${options.method || 'GET'} ${endpoint}.`)
  }
  return result as T
}

export { ADMIN_TOKEN_KEY, ADMIN_WELCOME_KEY, CUSTOMER_TOKEN_KEY }

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  token?: string
}

type ApiError = {
  error?: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const ADMIN_TOKEN_KEY = 'antixor-icy-admin-token'
const CUSTOMER_TOKEN_KEY = 'antixor-icy-customer-token'

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
    if (response.status === 401 && token) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      sessionStorage.removeItem(CUSTOMER_TOKEN_KEY)
      window.dispatchEvent(new Event('admin-session-expired'))
      window.dispatchEvent(new Event('customer-session-expired'))
    }
    if (result.error) throw new Error(result.error)
    const endpoint = new URL(`${API_BASE_URL}/api${path}`, window.location.origin).pathname
    throw new Error(`API request failed (${response.status}) for ${options.method || 'GET'} ${endpoint}.`)
  }
  return result as T
}

export { ADMIN_TOKEN_KEY, CUSTOMER_TOKEN_KEY }

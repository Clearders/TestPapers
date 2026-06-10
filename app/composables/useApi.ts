import type { ApiEnvelope } from '~/types/api'
import type { AuthSession } from '~/types/auth'
import { DEFAULT_API_BASE, normalizeEndpoint } from '~/utils/apiEndpoint'

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  query?: Record<string, unknown>
  body?: BodyInit | Record<string, any> | null
  headers?: Record<string, string>
  auth?: boolean
  retry?: number
  retryOnUnauthorized?: boolean
  timeoutMs?: number
}

let refreshPromise: Promise<boolean> | null = null
const DEFAULT_TIMEOUT_MS = 15_000
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const CSRF_COOKIE_NAME = 'testpapers_csrf'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function readCookie (name: string): string {
  if (import.meta.server) return ''
  const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=')[1] ?? '') : ''
}

function getApiBase () {
  const config = useRuntimeConfig()
  const apiBase = import.meta.server ? config.apiBase : config.public.apiBase
  return normalizeEndpoint(apiBase, DEFAULT_API_BASE)
}

function getStatusCode (error: unknown) {
  if (typeof error !== 'object' || error === null) return 0
  const candidate = error as { status?: number, statusCode?: number, response?: { status?: number } }
  return candidate.statusCode || candidate.status || candidate.response?.status || 0
}

function shouldRetryRequest (error: unknown, method: ApiRequestOptions['method']) {
  if (method && method !== 'GET') return false
  const statusCode = getStatusCode(error)
  return statusCode === 0 || RETRYABLE_STATUS_CODES.has(statusCode)
}

function waitForRetry (attempt: number) {
  return new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt))
}

function syncAuthSession (session: AuthSession | null) {
  const user = useState<AuthSession['user'] | null>('auth-user', () => null)
  const expiresAt = useState<string>('auth-expires-at', () => '')
  user.value = session?.user || null
  expiresAt.value = session?.expiresAt || ''
}

async function refreshSessionCookie () {
  if (refreshPromise) return await refreshPromise

  refreshPromise = (async () => {
    try {
      const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {}
      const csrfHeaders: Record<string, string> = {}
      if (import.meta.client) {
        const csrfToken = readCookie(CSRF_COOKIE_NAME)
        if (csrfToken) {
          csrfHeaders['x-csrf-token'] = csrfToken
        }
      }
      const response = await $fetch<ApiEnvelope<AuthSession>>('/auth/refresh', {
        baseURL: getApiBase(),
        method: 'POST',
        credentials: 'include',
        timeout: DEFAULT_TIMEOUT_MS,
        headers: {
          ...requestHeaders,
          ...csrfHeaders
        }
      })
      syncAuthSession(response.data)
      return true
    } catch {
      syncAuthSession(null)
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return await refreshPromise
}

export function useApi () {
  function authHeaders () {
    return {}
  }

  async function apiFetch<T> (path: string, options: ApiRequestOptions = {}) {
    const {
      auth = true,
      retryOnUnauthorized = true,
      headers = {},
      method = 'GET',
      retry,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      ...fetchOptions
    } = options
    const retryLimit = retry ?? (method === 'GET' ? 1 : 0)

    // Only fetch request headers on server side
    const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {}

    // Include CSRF token for non-safe requests on the client side
    const csrfHeaders: Record<string, string> = {}
    if (import.meta.client && !SAFE_METHODS.has(method)) {
      const csrfToken = readCookie(CSRF_COOKIE_NAME)
      if (csrfToken) {
        csrfHeaders['x-csrf-token'] = csrfToken
      }
    }

    const makeRequest = async () => {
      for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
        try {
          return await $fetch<ApiEnvelope<T>>(path, {
            baseURL: getApiBase(),
            credentials: 'include',
            method,
            ...fetchOptions,
            retry: 0,
            timeout: timeoutMs,
            headers: {
              ...requestHeaders,
              ...csrfHeaders,
              ...headers
            }
          })
        } catch (error) {
          if (attempt >= retryLimit || !shouldRetryRequest(error, method)) throw error
          await waitForRetry(attempt)
        }
      }

      throw new Error('API request failed')
    }

    const requestOnce = () => $fetch<ApiEnvelope<T>>(path, {
      baseURL: getApiBase(),
      credentials: 'include',
      method,
      ...fetchOptions,
      retry: 0,
      timeout: timeoutMs,
      headers: {
        ...requestHeaders,
        ...csrfHeaders,
        ...headers
      }
    })

    try {
      return await makeRequest()
    } catch (error) {
      const shouldRefresh = import.meta.client && auth && retryOnUnauthorized && path !== '/auth/refresh' && getStatusCode(error) === 401
      if (!shouldRefresh || !(await refreshSessionCookie())) {
        throw error
      }

      return await requestOnce()
    }
  }

  return {
    apiFetch,
    authHeaders,
    getApiBase,
    refreshSessionCookie
  }
}

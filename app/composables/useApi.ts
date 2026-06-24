import type { ApiEnvelope } from '~/types/api'
import type { AuthSession } from '~/types/auth'
import { extractApiErrorInfo, getStatusCode } from '~/utils/apiError'
import { DEFAULT_API_BASE, normalizeEndpoint } from '~/utils/apiEndpoint'
import { AUTH_STATE_KEYS } from '~/utils/authStateKeys'

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
type ApiRequestBody = BodyInit | object | null

export interface ApiRequestOptions {
  method?: ApiMethod
  query?: Record<string, unknown>
  body?: ApiRequestBody
  headers?: Record<string, string>
  auth?: boolean
  retry?: number
  retryOnUnauthorized?: boolean
  timeoutMs?: number
  responseType?: 'json' | 'blob'
  rawResponse?: boolean
}

let refreshPromise: Promise<boolean> | null = null
let refreshTimerId: ReturnType<typeof setTimeout> | null = null
const DEFAULT_TIMEOUT_MS = 15_000
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const CSRF_COOKIE_NAME = 'testpapers_csrf'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function readCookie (name: string): string {
  if (import.meta.server) return ''
  const value = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') ?? ''
  return value ? decodeURIComponent(value) : ''
}

function getApiBase () {
  const config = useRuntimeConfig()
  const apiBase = import.meta.server ? config.apiBase : config.public.apiBase
  return normalizeEndpoint(apiBase, DEFAULT_API_BASE)
}

function getBlobApiBase () {
  const config = useRuntimeConfig()
  const apiBase = import.meta.client && config.public.directApiBase
    ? config.public.directApiBase
    : getApiBase()
  return normalizeEndpoint(apiBase, DEFAULT_API_BASE)
}

function shouldRetryRequest (error: unknown, method: ApiMethod) {
  if (method !== 'GET') return false
  const statusCode = getStatusCode(error)
  return statusCode === 0 || RETRYABLE_STATUS_CODES.has(statusCode)
}

function waitForRetry (attempt: number) {
  return new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt))
}

function isPlainRecord (value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function isJsonBody (body: ApiRequestBody): body is Record<string, unknown> {
  return isPlainRecord(body)
}

function serializeBody (body: ApiRequestBody): BodyInit | undefined {
  if (body == null) return undefined
  return isJsonBody(body) ? JSON.stringify(body) : body as BodyInit
}

function bodyHeaders (body: ApiRequestBody): Record<string, string> {
  return isJsonBody(body) ? { 'Content-Type': 'application/json' } : {}
}

function buildQueryString (query?: Record<string, unknown>) {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else {
      params.set(key, String(value))
    }
  }
  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

function csrfHeaders (method: ApiMethod): Record<string, string> {
  if (import.meta.server || SAFE_METHODS.has(method)) return {}
  const csrfToken = readCookie(CSRF_COOKIE_NAME)
  return csrfToken ? { 'x-csrf-token': csrfToken } : {}
}

function requestHeaders (method: ApiMethod, headers: Record<string, string> = {}) {
  const serverHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {}
  return {
    ...serverHeaders,
    ...csrfHeaders(method),
    ...headers
  }
}

async function fetchWithTimeout (url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function responseError (response: Response) {
  return {
    status: response.status,
    statusCode: response.status,
    message: await response.text().catch(() => response.statusText)
  }
}

async function withRetry<T> (request: () => Promise<T>, method: ApiMethod, retryLimit: number) {
  let lastError: unknown
  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    try {
      return await request()
    } catch (error) {
      lastError = error
      if (attempt >= retryLimit || !shouldRetryRequest(error, method)) break
      await waitForRetry(attempt)
    }
  }
  throw lastError
}

function syncAuthSession (session: AuthSession | null) {
  if (import.meta.server) return

  const user = useState<AuthSession['user'] | null>(AUTH_STATE_KEYS.user, () => null)
  const expiresAt = useState<string>(AUTH_STATE_KEYS.expiresAt, () => '')
  user.value = session?.user || null
  expiresAt.value = session?.expiresAt || ''

  scheduleSessionRefresh(session?.expiresAt || '')
}

function scheduleSessionRefresh (expiresAt: string) {
  if (import.meta.server) return
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId)
    refreshTimerId = null
  }
  if (!expiresAt) return

  const expires = Date.parse(expiresAt)
  if (!Number.isFinite(expires)) return

  const skew = 2 * 60 * 1000
  const delay = Math.max(5_000, expires - skew - Date.now())
  refreshTimerId = setTimeout(() => {
    refreshTimerId = null
    void refreshSessionCookie()
  }, delay)
}

async function refreshSessionCookie () {
  if (refreshPromise) return await refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await $fetch<ApiEnvelope<AuthSession>>('/auth/refresh', {
        baseURL: getApiBase(),
        method: 'POST',
        credentials: 'include',
        timeout: DEFAULT_TIMEOUT_MS,
        headers: requestHeaders('POST')
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
  async function apiFetch<T> (path: string, options: ApiRequestOptions = {}) {
    const {
      auth = true,
      retryOnUnauthorized = true,
      headers = {},
      method = 'GET',
      retry,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      responseType = 'json',
      rawResponse = false,
      query,
      body = null
    } = options
    const retryLimit = retry ?? (method === 'GET' ? 1 : 0)

    if (responseType === 'blob') {
      const url = `${getBlobApiBase()}${path}${buildQueryString(query)}`
      const fetchBlob = async () => {
        const response = await fetchWithTimeout(url, {
          method,
          credentials: 'include',
          headers: {
            ...requestHeaders(method, headers),
            ...bodyHeaders(body)
          },
          body: serializeBody(body)
        }, timeoutMs)

        const shouldRefresh = import.meta.client && auth && retryOnUnauthorized && path !== '/auth/refresh' && response.status === 401
        if (shouldRefresh && await refreshSessionCookie()) {
          const retryResponse = await fetchWithTimeout(url, {
            method,
            credentials: 'include',
            headers: {
              ...requestHeaders(method, headers),
              ...bodyHeaders(body)
            },
            body: serializeBody(body)
          }, timeoutMs)
          if (!retryResponse.ok) throw await responseError(retryResponse)
          if (rawResponse) return retryResponse as unknown as ApiEnvelope<T>
          return { data: await retryResponse.blob() as unknown as T } as ApiEnvelope<T>
        }

        if (!response.ok) throw await responseError(response)
        if (rawResponse) return response as unknown as ApiEnvelope<T>
        return { data: await response.blob() as unknown as T } as ApiEnvelope<T>
      }

      try {
        return await withRetry(fetchBlob, method, retryLimit)
      } catch (error) {
        throw extractApiErrorInfo(error)
      }
    }

    const fetchJson = () => $fetch<ApiEnvelope<T>>(path, {
      baseURL: getApiBase(),
      credentials: 'include',
      method,
      query,
      ...(body !== null ? { body } : {}),
      retry: 0,
      timeout: timeoutMs,
      headers: requestHeaders(method, headers)
    })

    try {
      return await withRetry(fetchJson, method, retryLimit)
    } catch (error) {
      const shouldRefresh = import.meta.client && auth && retryOnUnauthorized && path !== '/auth/refresh' && getStatusCode(error) === 401
      if (!shouldRefresh || !(await refreshSessionCookie())) {
        throw extractApiErrorInfo(error)
      }

      try {
        return await fetchJson()
      } catch (retryError) {
        throw extractApiErrorInfo(retryError)
      }
    }
  }

  return {
    apiFetch,
    getApiBase,
    refreshSessionCookie,
    scheduleSessionRefresh
  }
}

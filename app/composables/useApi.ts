import type { ApiEnvelope } from '~/types/api'
import type { AuthSession } from '~/types/auth'

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  query?: Record<string, unknown>
  body?: BodyInit | Record<string, any> | null
  headers?: Record<string, string>
  auth?: boolean
  retryOnUnauthorized?: boolean
}

let refreshPromise: Promise<boolean> | null = null

function getApiBase () {
  const config = useRuntimeConfig()
  return config.public.apiBase || 'http://127.0.0.1:8010/api/v1'
}

function getStatusCode (error: unknown) {
  if (typeof error !== 'object' || error === null) return 0
  const candidate = error as { status?: number, statusCode?: number, response?: { status?: number } }
  return candidate.statusCode || candidate.status || candidate.response?.status || 0
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
      const response = await $fetch<ApiEnvelope<AuthSession>>('/auth/refresh', {
        baseURL: getApiBase(),
        method: 'POST',
        credentials: 'include',
        headers: requestHeaders
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
      ...fetchOptions
    } = options

    // Only fetch request headers on server side
    const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {}

    const makeRequest = () => $fetch<ApiEnvelope<T>>(path, {
      baseURL: getApiBase(),
      credentials: 'include',
      ...fetchOptions,
      headers: {
        ...requestHeaders,
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

      return await makeRequest()
    }
  }

  return {
    apiFetch,
    authHeaders,
    getApiBase,
    refreshSessionCookie
  }
}

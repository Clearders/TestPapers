import type { ApiEnvelope } from '~/types/api'

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
  auth?: boolean
}

function getApiBase () {
  const config = useRuntimeConfig()
  return config.public.apiBase || 'http://127.0.0.1:8010/api/v1'
}

export function useApi () {
  const token = useState<string>('auth-token', () => '')

  function authHeaders () {
    return token.value
      ? { Authorization: `Bearer ${token.value}` }
      : {}
  }

  async function apiFetch<T> (path: string, options: ApiRequestOptions = {}) {
    const { auth = true, headers = {}, ...fetchOptions } = options

    return await $fetch<ApiEnvelope<T>>(path, {
      baseURL: getApiBase(),
      ...fetchOptions,
      headers: {
        ...(auth ? authHeaders() : {}),
        ...headers
      }
    })
  }

  return {
    apiFetch,
    authHeaders,
    getApiBase
  }
}

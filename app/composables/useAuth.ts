import type { AuthSession, AuthUser, Permission, RegisterPayload } from '~/types/auth'

export type { AuthSession, AuthUser, Permission, RegisterPayload, UserRole } from '~/types/auth'

const REFRESH_SKEW_MS = 2 * 60 * 1000
let sessionLoadPromise: Promise<AuthUser | null> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function useAuth () {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const expiresAt = useState<string>('auth-expires-at', () => '')
  const isAuthReady = useState<boolean>('auth-ready', () => false)
  const { apiFetch, authHeaders, refreshSessionCookie } = useApi()

  const isAuthenticated = computed(() => Boolean(user.value))
  const authFetch = apiFetch

  function hasPermission (permission: Permission) {
    return Boolean(user.value?.permissions.includes(permission))
  }

  function applySession (session: AuthSession | null) {
    user.value = session?.user || null
    expiresAt.value = session?.expiresAt || ''
    isAuthReady.value = true
    scheduleRefresh()
  }

  function clearSession () {
    applySession(null)
  }

  function scheduleRefresh () {
    if (import.meta.server) return
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = null

    if (!expiresAt.value) return
    const refreshAt = new Date(expiresAt.value).getTime() - REFRESH_SKEW_MS
    const delay = Math.max(5_000, refreshAt - Date.now())

    refreshTimer = setTimeout(() => {
      void refreshSession()
    }, delay)
  }

  async function refreshSession () {
    const refreshed = await refreshSessionCookie()
    isAuthReady.value = true
    scheduleRefresh()
    return refreshed ? user.value : null
  }

  async function loadSession (options: { force?: boolean } = {}) {
    if (isAuthReady.value && !options.force) return user.value
    if (sessionLoadPromise && !options.force) return await sessionLoadPromise

    sessionLoadPromise = loadSessionInternal()
    try {
      return await sessionLoadPromise
    } finally {
      sessionLoadPromise = null
    }
  }

  async function loadSessionInternal () {
    try {
      if (import.meta.server) {
        const response = await apiFetch<AuthUser>('/auth/me', {
          method: 'GET',
          auth: false,
          retryOnUnauthorized: false
        })
        user.value = response.data
        expiresAt.value = ''
        isAuthReady.value = true
        return response.data
      }

      const response = await apiFetch<AuthSession>('/auth/refresh', {
        method: 'POST',
        auth: false,
        retryOnUnauthorized: false
      })
      applySession(response.data)
      return response.data.user
    } catch {
      clearSession()
      return null
    }
  }

  async function login (username: string, password: string) {
    const response = await apiFetch<AuthSession>('/auth/login', {
      method: 'POST',
      auth: false,
      retryOnUnauthorized: false,
      body: {
        username,
        password
      }
    })

    applySession(response.data)
    return response.data.user
  }

  async function register (payload: RegisterPayload) {
    const response = await apiFetch<AuthSession>('/auth/register', {
      method: 'POST',
      auth: false,
      retryOnUnauthorized: false,
      body: payload
    })

    applySession(response.data)
    return response.data.user
  }

  async function logout () {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        auth: false,
        retryOnUnauthorized: false
      })
    } catch {
      // Local logout should still succeed when the server is unavailable.
    } finally {
      clearSession()
      await navigateTo('/login')
    }
  }

  return {
    authFetch,
    authHeaders,
    clearSession,
    expiresAt,
    hasPermission,
    isAuthenticated,
    isAuthReady,
    loadSession,
    login,
    logout,
    refreshSession,
    register,
    scheduleRefresh,
    user
  }
}

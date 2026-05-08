import type { AuthSession, AuthUser, Permission, RegisterPayload } from '~/types/auth'

export type { AuthSession, AuthUser, Permission, RegisterPayload, UserRole } from '~/types/auth'

const AUTH_TOKEN_KEY = 'testpapers-auth-token'
let sessionLoadPromise: Promise<AuthUser | null> | null = null

function getStoredToken () {
  if (import.meta.server) return ''
  return localStorage.getItem(AUTH_TOKEN_KEY) || ''
}

function saveStoredToken (token: string) {
  if (import.meta.server) return
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
  else localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function useAuth () {
  const token = useState<string>('auth-token', () => getStoredToken())
  const user = useState<AuthUser | null>('auth-user', () => null)
  const isAuthReady = useState<boolean>('auth-ready', () => false)
  const { apiFetch, authHeaders } = useApi()

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  const authFetch = apiFetch

  function hasPermission (permission: Permission) {
    return Boolean(user.value?.permissions.includes(permission))
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
    if (!token.value) {
      isAuthReady.value = true
      user.value = null
      return null
    }

    try {
      const response = await apiFetch<AuthUser>('/auth/me', { method: 'GET' })
      user.value = response.data
      return response.data
    } catch {
      token.value = ''
      user.value = null
      saveStoredToken('')
      return null
    } finally {
      isAuthReady.value = true
    }
  }

  async function login (username: string, password: string) {
    const response = await apiFetch<AuthSession>('/auth/login', {
      method: 'POST',
      auth: false,
      body: {
        username,
        password
      }
    })

    token.value = response.data.token
    user.value = response.data.user
    isAuthReady.value = true
    saveStoredToken(response.data.token)
    return response.data.user
  }

  async function register (payload: RegisterPayload) {
    const response = await apiFetch<AuthSession>('/auth/register', {
      method: 'POST',
      auth: false,
      body: payload
    })

    token.value = response.data.token
    user.value = response.data.user
    isAuthReady.value = true
    saveStoredToken(response.data.token)
    return response.data.user
  }

  async function logout () {
    if (token.value) {
      try {
        await apiFetch('/auth/logout', { method: 'POST' })
      } catch {
        // Local logout should still succeed when the server is unavailable.
      }
    }
    token.value = ''
    user.value = null
    isAuthReady.value = true
    saveStoredToken('')
    await navigateTo('/login')
  }

  return {
    authFetch,
    authHeaders,
    hasPermission,
    isAuthenticated,
    isAuthReady,
    loadSession,
    login,
    logout,
    register,
    token,
    user
  }
}

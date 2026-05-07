export type Permission =
  | 'questions:read'
  | 'questions:write'
  | 'questions:delete'
  | 'answers:read'
  | 'papers:read'
  | 'papers:write'
  | 'users:manage'

export type UserRole = 'admin' | 'teacher' | 'viewer'

export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
  meta?: {
    requestId?: string
  }
}

interface AuthSession {
  token: string
  tokenType: 'bearer'
  expiresAt: string
  user: AuthUser
}

const AUTH_TOKEN_KEY = 'testpapers-auth-token'

function getApiBase () {
  const config = useRuntimeConfig()
  return config.public.apiBase || 'http://127.0.0.1:8010/api/v1'
}

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

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  function authHeaders () {
    return token.value
      ? { Authorization: `Bearer ${token.value}` }
      : {}
  }

  async function authFetch<T> (path: string, options: any = {}) {
    return await $fetch<ApiEnvelope<T>>(path, {
      baseURL: getApiBase(),
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    })
  }

  function hasPermission (permission: Permission) {
    return Boolean(user.value?.permissions.includes(permission))
  }

  async function loadSession () {
    if (!token.value) {
      isAuthReady.value = true
      user.value = null
      return null
    }

    try {
      const response = await authFetch<AuthUser>('/auth/me', { method: 'GET' })
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
    const response = await $fetch<ApiEnvelope<AuthSession>>('/auth/login', {
      baseURL: getApiBase(),
      method: 'POST',
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

  async function logout () {
    if (token.value) {
      try {
        await authFetch('/auth/logout', { method: 'POST' })
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
    token,
    user
  }
}

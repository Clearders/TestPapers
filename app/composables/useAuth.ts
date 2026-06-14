import type { AuthSession, AuthUser, PasswordChangePayload, Permission, ProfileUpdatePayload, RegisterPayload } from '~/types/auth'

export type { AuthSession, AuthUser, Permission, RegisterPayload, UserRole } from '~/types/auth'
export type { PasswordChangePayload, ProfileUpdatePayload }

let sessionLoadPromise: Promise<AuthUser | null> | null = null

export function useAuth () {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const expiresAt = useState<string>('auth-expires-at', () => '')
  const isAuthReady = useState<boolean>('auth-ready', () => false)
  const { apiFetch, refreshSessionCookie, scheduleSessionRefresh } = useApi()

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
    scheduleSessionRefresh(expiresAt.value)
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

  async function updateProfile (payload: ProfileUpdatePayload): Promise<AuthUser> {
    const response = await apiFetch<AuthUser>('/auth/profile', {
      method: 'PATCH',
      body: payload
    })
    user.value = response.data
    return response.data
  }

  async function changePassword (payload: PasswordChangePayload): Promise<void> {
    await apiFetch('/auth/password', {
      method: 'PUT',
      body: payload
    })
  }

  async function uploadAvatar (file: File): Promise<string> {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const parts = result.split(',')
        resolve(parts[1] || '')
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
    const response = await apiFetch<{ url: string }>('/auth/avatar', {
      method: 'POST',
      body: {
        filename: file.name,
        data: base64,
        mimeType: file.type || 'image/png'
      }
    })
    if (user.value) {
      user.value = { ...user.value, avatarUrl: response.data.url }
    }
    return response.data.url
  }

  async function deleteAccount (): Promise<void> {
    await apiFetch('/auth/account', {
      method: 'DELETE',
      auth: false,
      retryOnUnauthorized: false
    })
    clearSession()
    await navigateTo('/login')
  }

  return {
    authFetch,
    changePassword,
    clearSession,
    deleteAccount,
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
    updateProfile,
    uploadAvatar,
    user
  }
}

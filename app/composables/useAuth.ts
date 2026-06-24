import type { ShallowRef } from 'vue'
import type { AuthSession, AuthUser, PasswordChangePayload, Permission, ProfileUpdatePayload, RegisterPayload } from '~/types/auth'
import { AUTH_STATE_KEYS } from '~/utils/authStateKeys'
import { readFileAsBase64Payload } from '~/utils/fileData'

export type { AuthSession, AuthUser, Permission, RegisterPayload, UserRole } from '~/types/auth'
export type { PasswordChangePayload, ProfileUpdatePayload }

type AuthServerState = {
  user: ShallowRef<AuthUser | null>
  expiresAt: ShallowRef<string>
  isReady: ShallowRef<boolean>
}

type AuthServerContext = {
  authState?: AuthServerState
}

let sessionLoadPromise: Promise<AuthUser | null> | null = null

function createServerAuthState (): AuthServerState {
  return {
    user: shallowRef<AuthUser | null>(null),
    expiresAt: shallowRef(''),
    isReady: shallowRef(false)
  }
}

function useServerAuthState () {
  const event = useRequestEvent()
  if (!event) return createServerAuthState()

  const context = event.context as AuthServerContext
  context.authState ||= createServerAuthState()
  return context.authState
}

export function useAuth () {
  const authState = import.meta.server
    ? useServerAuthState()
      : {
        user: useState<AuthUser | null>(AUTH_STATE_KEYS.user, () => null),
        expiresAt: useState<string>(AUTH_STATE_KEYS.expiresAt, () => ''),
        isReady: useState<boolean>(AUTH_STATE_KEYS.ready, () => false)
      }
  const { user, expiresAt, isReady: isAuthReady } = authState
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
    if (import.meta.server) return await loadSessionInternal()
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
    const response = await apiFetch<{ url: string }>('/auth/avatar', {
      method: 'POST',
      body: {
        filename: file.name,
        data: await readFileAsBase64Payload(file),
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

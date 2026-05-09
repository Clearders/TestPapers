import type { Permission } from '~/types/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const { hasPermission, isAuthenticated, isAuthReady, loadSession } = useAuth()
  const requiresAuth = Boolean(to.meta.requiresAuth)
  const guestOnly = Boolean(to.meta.guestOnly)
  const permissions = (to.meta.permissions || []) as Permission[]

  if (!isAuthReady.value || requiresAuth || permissions.length) {
    await loadSession()
  }

  if (guestOnly && isAuthenticated.value) {
    return navigateTo('/questions')
  }

  if ((requiresAuth || permissions.length) && !isAuthenticated.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }

  if (permissions.some(permission => !hasPermission(permission))) {
    return navigateTo('/')
  }
})

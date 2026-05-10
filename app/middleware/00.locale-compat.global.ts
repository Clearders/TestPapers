import { hasLegacyLocalePrefix, stripLegacyLocalePrefix } from '~~/shared/legacy-locale'

export default defineNuxtRouteMiddleware((to) => {
  if (!hasLegacyLocalePrefix(to.path)) return

  return navigateTo({
    path: stripLegacyLocalePrefix(to.path),
    query: to.query,
    hash: to.hash
  }, {
    redirectCode: 308,
    replace: true
  })
})

import { getRequestURL, sendRedirect } from 'h3'
import { hasLegacyLocalePrefix, stripLegacyLocalePrefix } from '~~/shared/legacy-locale'

export default defineEventHandler((event) => {
  const url = getRequestURL(event)

  if (!hasLegacyLocalePrefix(url.pathname)) return

  const targetPath = stripLegacyLocalePrefix(url.pathname)
  const location = `${targetPath}${url.search}`

  return sendRedirect(event, location, 308)
})

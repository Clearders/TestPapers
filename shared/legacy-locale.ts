const LEGACY_LOCALE_PREFIX_RE = /^\/(en|zh)(?=\/|$)/i

export function stripLegacyLocalePrefix (path: string) {
  if (!path) return '/'

  const normalized = path.startsWith('/') ? path : `/${path}`
  const stripped = normalized.replace(LEGACY_LOCALE_PREFIX_RE, '') || '/'

  return stripped.startsWith('/') ? stripped : `/${stripped}`
}

export function hasLegacyLocalePrefix (path: string) {
  return LEGACY_LOCALE_PREFIX_RE.test(path)
}

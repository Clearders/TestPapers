const PROFILE_NAMES = ['local', 'development', 'test', 'staging', 'production']
const DEPLOYMENT_PROFILES = new Set(['staging', 'production'])
const LOCAL_PROFILES = new Set(['local', 'development'])

export class RuntimeConfigError extends Error {
  constructor(messages) {
    super(`Invalid TestPapers runtime configuration:\n${messages.map(message => `- ${message}`).join('\n')}`)
    this.name = 'RuntimeConfigError'
  }
}

function value(env, name) {
  return typeof env[name] === 'string' ? env[name].trim() : ''
}

function stripTrailingSlash(endpoint) {
  return endpoint.replace(/\/+$/, '')
}

function validateAbsoluteUrl(name, endpoint, allowedProtocols, errors) {
  try {
    const parsed = new URL(endpoint)
    if (!allowedProtocols.includes(parsed.protocol)) {
      errors.push(`${name} must use ${allowedProtocols.join(' or ')}.`)
    }
    if (parsed.username || parsed.password) errors.push(`${name} must not include URL credentials.`)
    if (parsed.search || parsed.hash) errors.push(`${name} must not include a query string or fragment.`)
  } catch {
    errors.push(`${name} must be an absolute URL.`)
  }
}

function validatePublicApiBase(profile, endpoint, errors) {
  if (endpoint.startsWith('/')) {
    if (endpoint.startsWith('//') || endpoint.includes('\\') || endpoint.includes('?') || endpoint.includes('#')) {
      errors.push('NUXT_PUBLIC_API_BASE must be a same-origin path with one leading slash and no query string, fragment, or backslash.')
    }
    return
  }
  validateAbsoluteUrl('NUXT_PUBLIC_API_BASE', endpoint, ['https:'], errors)
  if (DEPLOYMENT_PROFILES.has(profile) && !endpoint.startsWith('https://')) {
    errors.push('NUXT_PUBLIC_API_BASE must be a same-origin path or an HTTPS URL in staging and production.')
  }
}

export function resolveRuntimeConfig(sourceEnv = process.env) {
  const env = sourceEnv ?? {}
  const profile = value(env, 'TESTPAPERS_ENV') || 'local'
  const errors = []
  if (!PROFILE_NAMES.includes(profile)) {
    errors.push(`TESTPAPERS_ENV must be one of: ${PROFILE_NAMES.join(', ')}.`)
  }

  const canonicalServerApiBase = value(env, 'NUXT_API_BASE')
  const legacyServerApiBase = value(env, 'NUXT_SERVER_API_BASE')
  if (canonicalServerApiBase && legacyServerApiBase && stripTrailingSlash(canonicalServerApiBase) !== stripTrailingSlash(legacyServerApiBase)) {
    errors.push('NUXT_API_BASE conflicts with legacy NUXT_SERVER_API_BASE; set only NUXT_API_BASE.')
  }

  const serverApiBase = canonicalServerApiBase || legacyServerApiBase || (LOCAL_PROFILES.has(profile) ? 'http://127.0.0.1:8000/api/v1' : '')
  const publicApiBase = value(env, 'NUXT_PUBLIC_API_BASE') || (LOCAL_PROFILES.has(profile) ? '/api/v1' : '')
  const directApiBase = value(env, 'NUXT_PUBLIC_DIRECT_API_BASE') || publicApiBase
  const wsBase = value(env, 'NUXT_PUBLIC_WS_BASE')

  if (!serverApiBase) errors.push(`NUXT_API_BASE is required when TESTPAPERS_ENV=${profile}.`)
  if (!publicApiBase) errors.push(`NUXT_PUBLIC_API_BASE is required when TESTPAPERS_ENV=${profile}.`)
  if (serverApiBase) validateAbsoluteUrl('NUXT_API_BASE', serverApiBase, ['http:', 'https:'], errors)
  if (publicApiBase) validatePublicApiBase(profile, publicApiBase, errors)
  if (value(env, 'NUXT_PUBLIC_DIRECT_API_BASE')) validateAbsoluteUrl('NUXT_PUBLIC_DIRECT_API_BASE', directApiBase, ['https:'], errors)
  if (wsBase) validateAbsoluteUrl('NUXT_PUBLIC_WS_BASE', wsBase, ['wss:'], errors)

  if (errors.length) throw new RuntimeConfigError(errors)
  return {
    profile,
    serverApiBase: stripTrailingSlash(serverApiBase),
    publicApiBase: stripTrailingSlash(publicApiBase),
    publicDirectApiBase: stripTrailingSlash(directApiBase),
    wsBase: stripTrailingSlash(wsBase)
  }
}
